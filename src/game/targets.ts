import type { Candidate } from './matching'
import type { Country, RegionId } from '../data/types'

export type TargetKind = 'country' | 'capital'
export type PlayMode = 'name' | 'locate'

export interface Question {
  /** Identifiant du pays (clé de géométrie). */
  id: string
  kind: TargetKind
  /** Libellé de la réponse attendue (nom du pays ou de la capitale). */
  label: string
  /** Pays auquel appartient la question, pour le contexte. */
  countryName: string
  /** Points à montrer ou à retrouver : centre du pays (micro-États) ou capitales. */
  points: { lon: number; lat: number; label: string }[]
}

export interface TargetDef {
  kind: TargetKind
  label: string
  eligible: (c: Country) => boolean
  question: (c: Country) => Question
  pool: (all: Country[]) => Candidate[]
}

export const countryPool = (all: Country[]): Candidate[] =>
  all.map((c) => ({ id: c.id, names: [c.name, ...c.aliases] }))

export const capitalPool = (all: Country[]): Candidate[] =>
  all.map((c) => ({ id: c.id, names: c.capitals.flatMap((k) => [k.fr, ...k.aliases]) }))

export const TARGETS: Record<TargetKind, TargetDef> = {
  country: {
    kind: 'country',
    label: 'Pays',
    eligible: () => true,
    question: (c) => ({
      id: c.id,
      kind: 'country',
      label: c.name,
      countryName: c.name,
      points: [{ lon: c.lon, lat: c.lat, label: c.name }],
    }),
    pool: countryPool,
  },
  capital: {
    kind: 'capital',
    label: 'Capitales',
    eligible: (c) => !c.cityState,
    question: (c) => ({
      id: c.id,
      kind: 'capital',
      label: c.capitals[0].fr,
      countryName: c.name,
      points: c.capitals.map((k) => ({ lon: k.lon, lat: k.lat, label: k.fr })),
    }),
    pool: capitalPool,
  },
}

export function poolFor(kind: TargetKind, region: RegionId, all: Country[]): Country[] {
  const def = TARGETS[kind]
  return all.filter((c) => def.eligible(c) && (region === 'world' || c.region === region))
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildQuestions(kind: TargetKind, region: RegionId, count: number, all: Country[]): Question[] {
  const def = TARGETS[kind]
  const picked = shuffle(poolFor(kind, region, all))
  return (count > 0 ? picked.slice(0, count) : picked).map(def.question)
}
