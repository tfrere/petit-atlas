import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { geoArea, geoCentroid } from 'd3-geo'
import { feature, merge, neighbors } from 'topojson-client'
import type {
  GeometryCollection,
  MultiPolygon as MultiPolygon_,
  Polygon as Polygon_,
  Topology,
} from 'topojson-specification'
import countriesJson from './countries.json'
import type { Country } from './types'

export const COUNTRIES = countriesJson as Country[]
export const COUNTRY_BY_ID = new Map(COUNTRIES.map((c) => [c.id, c]))

export interface WorldShape {
  id: string
  name: string
  feature: Feature<Polygon | MultiPolygon>
  /** Parties principales du pays (îles lointaines exclues), utilisées pour cadrer la caméra. */
  focus: Feature<Polygon | MultiPolygon>
  centroid: [number, number]
  colorIndex: number
}

export interface WorldData {
  shapes: WorldShape[]
  byId: Map<string, WorldShape>
}

const COLOR_COUNT = 5

function polygonsOf(f: Feature<Polygon | MultiPolygon>): Polygon['coordinates'][] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
}

function focusOf(f: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
  const polys = polygonsOf(f)
  const areas = polys.map((coordinates) => geoArea({ type: 'Polygon', coordinates }))
  const max = Math.max(...areas)
  const kept = polys.filter((_, i) => areas[i] >= max * 0.08)
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPolygon', coordinates: kept },
  }
}

function colorShapes(ids: string[], adjacency: Map<string, Set<string>>, weight: Map<string, number>) {
  const order = [...ids].sort(
    (a, b) =>
      (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0) || (weight.get(b) ?? 0) - (weight.get(a) ?? 0),
  )
  const colors = new Map<string, number>()
  for (const id of order) {
    const used = new Set<number>()
    for (const n of adjacency.get(id) ?? []) {
      const c = colors.get(n)
      if (c !== undefined) used.add(c)
    }
    let pick = 0
    while (used.has(pick) && pick < COLOR_COUNT - 1) pick++
    colors.set(id, pick)
  }
  return colors
}

export function prepareWorld(topology: Topology): WorldData {
  const collection = topology.objects.countries as GeometryCollection<{ name?: string }>
  const geoms = collection.geometries.filter((g) => g.id !== 'ATA')

  const groups = new Map<string, typeof geoms>()
  for (const g of geoms) {
    const id = String(g.id)
    groups.set(id, [...(groups.get(id) ?? []), g])
  }

  const adjacency = new Map<string, Set<string>>()
  const touching = neighbors(geoms)
  geoms.forEach((g, i) => {
    const a = String(g.id)
    for (const j of touching[i]) {
      const b = String(geoms[j].id)
      if (a === b) continue
      if (!adjacency.has(a)) adjacency.set(a, new Set())
      if (!adjacency.has(b)) adjacency.set(b, new Set())
      adjacency.get(a)!.add(b)
      adjacency.get(b)!.add(a)
    }
  })

  const shapes: WorldShape[] = []
  const weight = new Map<string, number>()
  for (const [id, list] of groups) {
    let f: Feature<Polygon | MultiPolygon>
    if (list.length === 1) {
      f = feature(topology, list[0]) as Feature<Polygon | MultiPolygon>
    } else {
      f = {
        type: 'Feature',
        properties: {},
        geometry: merge(topology, list as unknown as (Polygon_ | MultiPolygon_)[]) as MultiPolygon,
      }
    }
    const focus = focusOf(f)
    const name = COUNTRY_BY_ID.get(id)?.name ?? (list[0].properties as { name?: string } | undefined)?.name ?? id
    weight.set(id, geoArea(f))
    shapes.push({
      id,
      name,
      feature: f,
      focus,
      centroid: geoCentroid(focus) as [number, number],
      colorIndex: 0,
    })
  }

  const colors = colorShapes(
    shapes.map((s) => s.id),
    adjacency,
    weight,
  )
  for (const s of shapes) s.colorIndex = colors.get(s.id) ?? 0

  return { shapes, byId: new Map(shapes.map((s) => [s.id, s])) }
}

export async function loadWorld(): Promise<WorldData> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/world.json`)
  if (!res.ok) throw new Error(`Chargement de la carte impossible (${res.status})`)
  const topology = (await res.json()) as Topology
  return prepareWorld(topology)
}
