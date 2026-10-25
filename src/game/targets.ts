import type { Candidate } from './matching'
import { COUNTRIES } from '../data/world'
import { FLOWS } from '../data/flows'
import type { Flow, Temperature } from '../data/flows'
import type { Country, RegionId } from '../data/types'

export type TargetKind = 'country' | 'capital' | 'current' | 'wind'
export type PlayMode = 'name' | 'locate'

export interface Question {
  /** Identifiant de l'entité : pays (clé de géométrie) ou courant / vent. */
  id: string
  kind: TargetKind
  /** Libellé de la réponse attendue (nom du pays, de la capitale, du courant ou du vent). */
  label: string
  /** Contexte à montrer avec la réponse : pays d'une capitale. */
  context: string
  /** Courants : chaud ou froid, pour l'énoncé et la couleur du tracé. */
  temp?: Temperature
  /** Phrase mémo affichée une fois la réponse donnée (courants et vents). */
  note?: string
  /** Points à montrer ou à retrouver : centre du pays (micro-États) ou capitales. */
  points: { lon: number; lat: number; label: string }[]
}

export interface Entry {
  id: string
  regions: RegionId[]
  /** Noms acceptés à la saisie, le premier étant le libellé. */
  names: string[]
  question: Question
}

export const isFlowKind = (kind: TargetKind) => kind === 'current' || kind === 'wind'

export const countryPool = (all: Country[]): Candidate[] =>
  all.map((c) => ({ id: c.id, names: [c.name, ...c.aliases] }))

export const capitalPool = (all: Country[]): Candidate[] =>
  all.map((c) => ({ id: c.id, names: c.capitals.flatMap((k) => [k.fr, ...k.aliases]) }))

const COURANT_PREFIX = /^courant (?:de la |de l[’']|des |du |de |d[’'])/i

/** « Courant des Canaries » est aussi accepté sous la forme « Canaries ». */
export function flowNames(flow: Flow): string[] {
  const names = [flow.name, ...flow.aliases]
  if (flow.kind !== 'current') return names
  const short = names.filter((n) => COURANT_PREFIX.test(n)).map((n) => n.replace(COURANT_PREFIX, ''))
  return [...names, ...short]
}

const TEMP_LABEL = { warm: 'Courant chaud', cold: 'Courant froid' }

function flowContext(flow: Flow): string {
  if (flow.kind === 'current') return flow.temp ? TEMP_LABEL[flow.temp] : 'Courant'
  return flow.regions.includes('planetary') ? 'Vent planétaire' : 'Vent local'
}

function flowEntry(flow: Flow): Entry {
  return {
    id: flow.id,
    regions: flow.regions,
    names: flowNames(flow),
    question: {
      id: flow.id,
      kind: flow.kind,
      label: flow.name,
      context: flowContext(flow),
      temp: flow.temp,
      note: flow.note,
      points: [],
    },
  }
}

const countryEntry = (c: Country): Entry => ({
  id: c.id,
  regions: [c.region],
  names: [c.name, ...c.aliases],
  question: {
    id: c.id,
    kind: 'country',
    label: c.name,
    context: c.name,
    points: [{ lon: c.lon, lat: c.lat, label: c.name }],
  },
})

const capitalEntry = (c: Country): Entry => ({
  id: c.id,
  regions: [c.region],
  names: c.capitals.flatMap((k) => [k.fr, ...k.aliases]),
  question: {
    id: c.id,
    kind: 'capital',
    label: c.capitals[0].fr,
    context: c.name,
    points: c.capitals.map((k) => ({ lon: k.lon, lat: k.lat, label: k.fr })),
  },
})

export interface TargetDef {
  kind: TargetKind
  label: string
  /** Mot au singulier pour les énoncés. */
  noun: string
  /** Zones proposées pour jouer ce type de cible. */
  regions: RegionId[]
  entries: () => Entry[]
}

const CONTINENTS: RegionId[] = ['world', 'Europe', 'Africa', 'Asia', 'Americas', 'Oceania']

export const TARGETS: Record<TargetKind, TargetDef> = {
  country: {
    kind: 'country',
    label: 'Pays',
    noun: 'pays',
    regions: CONTINENTS,
    entries: () => COUNTRIES.map(countryEntry),
  },
  capital: {
    kind: 'capital',
    label: 'Capitales',
    noun: 'capitale',
    regions: CONTINENTS,
    entries: () => COUNTRIES.filter((c) => !c.cityState).map(capitalEntry),
  },
  current: {
    kind: 'current',
    label: 'Courants',
    noun: 'courant',
    regions: ['world', 'Atlantic', 'Pacific', 'Indian'],
    entries: () => FLOWS.filter((f) => f.kind === 'current').map(flowEntry),
  },
  wind: {
    kind: 'wind',
    label: 'Vents',
    noun: 'vent',
    regions: ['world', 'planetary', 'Europe', 'Africa', 'Asia', 'Americas'],
    entries: () => FLOWS.filter((f) => f.kind === 'wind').map(flowEntry),
  },
}

const entryCache = new Map<TargetKind, Entry[]>()

export function entriesOf(kind: TargetKind): Entry[] {
  let list = entryCache.get(kind)
  if (!list) {
    list = TARGETS[kind].entries()
    entryCache.set(kind, list)
  }
  return list
}

export function poolFor(kind: TargetKind, region: RegionId): Entry[] {
  return entriesOf(kind).filter((e) => region === 'world' || e.regions.includes(region))
}

export const candidatesOf = (kind: TargetKind): Candidate[] =>
  entriesOf(kind).map((e) => ({ id: e.id, names: e.names }))

export function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildQuestions(kind: TargetKind, region: RegionId, count: number): Question[] {
  const picked = shuffle(poolFor(kind, region))
  return (count > 0 ? picked.slice(0, count) : picked).map((e) => e.question)
}

/** La zone choisie n'a pas de sens pour cette cible (ex. « Europe » pour les courants) : retour au monde. */
export const validRegion = (kind: TargetKind, region: RegionId): RegionId =>
  TARGETS[kind].regions.includes(region) ? region : 'world'
