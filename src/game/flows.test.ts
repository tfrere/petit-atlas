import { describe, expect, it } from 'vitest'
import { flowGeometry } from '../data/flowGeometry'
import { FLOWS } from '../data/flows'
import { regionById } from '../data/regions'
import { judgeFlowTap, FLOW_TOLERANCE_KM } from './flows'
import { judge } from './matching'
import { TARGETS, buildQuestions, candidatesOf, entriesOf, poolFor, validRegion } from './targets'

const ids = (kind: 'current' | 'wind') => entriesOf(kind).map((e) => e.id)

describe('données des courants et des vents', () => {
  it('a des identifiants et des noms uniques', () => {
    expect(new Set(FLOWS.map((f) => f.id)).size).toBe(FLOWS.length)
    expect(new Set(FLOWS.map((f) => f.name)).size).toBe(FLOWS.length)
  })

  it('a au moins 30 courants et 20 vents, chacun avec tracé, zone et mémo', () => {
    expect(ids('current').length).toBeGreaterThanOrEqual(30)
    expect(ids('wind').length).toBeGreaterThanOrEqual(20)
    for (const f of FLOWS) {
      expect(f.paths.length, f.id).toBeGreaterThan(0)
      expect(f.regions.length, f.id).toBeGreaterThan(0)
      expect(f.note.length, f.id).toBeGreaterThan(20)
      for (const p of f.paths) {
        expect(p.length, f.id).toBeGreaterThanOrEqual(3)
        for (const [lon, lat] of p) {
          expect(Math.abs(lat), f.id).toBeLessThanOrEqual(82)
          expect(Math.abs(lon), f.id).toBeLessThanOrEqual(260)
        }
      }
    }
  })

  it('propose uniquement des zones jouables pour chaque type', () => {
    for (const kind of ['current', 'wind'] as const) {
      for (const f of entriesOf(kind)) {
        for (const r of f.regions) expect(TARGETS[kind].regions, `${f.id} ${r}`).toContain(r)
      }
      for (const r of TARGETS[kind].regions) {
        expect(poolFor(kind, r).length, `${kind} ${r}`).toBeGreaterThanOrEqual(3)
        expect(regionById(r).id).toBe(r)
      }
    }
  })

  it('limite les courants aux océans et les vents aux continents ou aux grands vents', () => {
    expect(validRegion('current', 'Europe')).toBe('world')
    expect(validRegion('current', 'Pacific')).toBe('Pacific')
    expect(validRegion('wind', 'planetary')).toBe('planetary')
    expect(validRegion('country', 'planetary')).toBe('world')
  })

  it('construit des séries sans doublon', () => {
    const qs = buildQuestions('current', 'world', 0)
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
    expect(buildQuestions('wind', 'Europe', 5)).toHaveLength(5)
  })
})

describe('saisie des noms', () => {
  const current = (id: string, input: string) => judge(input, id, candidatesOf('current')).correct
  const wind = (id: string, input: string) => judge(input, id, candidatesOf('wind')).correct

  it('accepte le nom court d’un courant et les fautes de frappe', () => {
    expect(current('canaries', 'Courant des Canaries')).toBe(true)
    expect(current('canaries', 'canaries')).toBe(true)
    expect(current('humboldt', 'Humbolt')).toBe(true)
    expect(current('gulf-stream', 'gulf stream')).toBe(true)
    expect(current('alaska', 'Courant d’Alaska')).toBe(true)
    expect(current('kuroshio', 'Kuro-Shivo')).toBe(true)
  })

  it('distingue les courants voisins', () => {
    expect(current('bresil', 'Courant de Benguela')).toBe(false)
    expect(current('labrador', 'Courant du Brésil')).toBe(false)
    expect(current('nord-equatorial-atl', 'courant sud-équatorial (Atlantique)')).toBe(false)
  })

  it('accepte les vents sans article et distingue les moussons', () => {
    expect(wind('mistral', 'le mistral')).toBe(true)
    expect(wind('foehn', 'foehn')).toBe(true)
    expect(wind('mousson-ete', 'mousson d’été')).toBe(true)
    expect(wind('mousson-ete', 'mousson d’hiver')).toBe(false)
    expect(wind('alizes-nord-est', 'Alizés du sud-est')).toBe(false)
    expect(wind('quarantiemes', 'les quarantièmes rugissants')).toBe(true)
    expect(wind('mistral', 'tramontane')).toBe(false)
  })
})

describe('tracés', () => {
  it('lisse sans quitter la zone des points de contrôle', () => {
    const g = flowGeometry('gulf-stream')!
    const [first] = g.paths[0]
    expect(first).toEqual([-81.5, 24.4])
    expect(g.paths[0].length).toBeGreaterThan(30)
    for (const [lon, lat] of g.paths[0]) {
      expect(lon).toBeGreaterThan(-83)
      expect(lon).toBeLessThan(-49)
      expect(lat).toBeGreaterThan(23)
      expect(lat).toBeLessThan(45)
    }
  })
})

describe('toucher d’un tracé', () => {
  const pool = ids('current')

  it('valide un toucher posé sur le tracé', () => {
    const v = judgeFlowTap([-71, 37.5], 'gulf-stream', pool)!
    expect(v.correct).toBe(true)
    expect(v.km).toBeLessThan(150)
    expect(v.otherId).toBeNull()
  })

  it('refuse un toucher trop loin, avec la distance', () => {
    const v = judgeFlowTap([-30, -30], 'gulf-stream', pool)!
    expect(v.correct).toBe(false)
    expect(v.km).toBeGreaterThan(FLOW_TOLERANCE_KM)
  })

  it('signale le tracé voisin quand on désigne le mauvais', () => {
    const v = judgeFlowTap([-70, 33], 'labrador', pool)!
    expect(v.correct).toBe(false)
    expect(v.otherId).toBe('gulf-stream')
  })

  it('gère un tracé qui franchit l’antiméridien', () => {
    const v = judgeFlowTap([-175, -5.5], 'sud-equatorial-pac', ids('current'))!
    expect(v.correct).toBe(true)
    const w = judgeFlowTap([170, -5], 'sud-equatorial-pac', ids('current'))!
    expect(w.correct).toBe(true)
  })

  it('ne retient que les tracés de la série', () => {
    const v = judgeFlowTap([-70, 33], 'labrador', ['labrador'])!
    expect(v.otherId).toBeNull()
  })
})
