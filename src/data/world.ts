import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { geoArea, geoCentroid, geoDistance } from 'd3-geo'
import { feature, merge } from 'topojson-client'
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
}

export interface WorldData {
  shapes: WorldShape[]
  byId: Map<string, WorldShape>
}

function polygonsOf(f: Feature<Polygon | MultiPolygon>): Polygon['coordinates'][] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
}

/** Rayon (en radians) autour de la plus grande partie d'un pays pour cadrer la caméra (~34°). */
const FOCUS_RADIUS = 0.6

function focusOf(f: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
  const polys = polygonsOf(f).map((coordinates) => {
    const poly: Polygon = { type: 'Polygon', coordinates }
    return { coordinates, area: geoArea(poly), center: geoCentroid(poly) }
  })
  const main = polys.reduce((a, b) => (b.area > a.area ? b : a))
  const kept = polys
    .filter((p) => p.area >= main.area * 0.08 && geoDistance(p.center, main.center) < FOCUS_RADIUS)
    .map((p) => p.coordinates)
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPolygon', coordinates: kept },
  }
}

export function prepareWorld(topology: Topology): WorldData {
  const collection = topology.objects.countries as GeometryCollection<{ name?: string }>
  const geoms = collection.geometries.filter((g) => g.id !== 'ATA')

  const groups = new Map<string, typeof geoms>()
  for (const g of geoms) {
    const id = String(g.id)
    groups.set(id, [...(groups.get(id) ?? []), g])
  }

  const shapes: WorldShape[] = []
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
    shapes.push({
      id,
      name,
      feature: f,
      focus,
      centroid: geoCentroid(focus) as [number, number],
    })
  }

  return { shapes, byId: new Map(shapes.map((s) => [s.id, s])) }
}

export async function loadWorld(): Promise<WorldData> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/world.json`)
  if (!res.ok) throw new Error(`Chargement de la carte impossible (${res.status})`)
  const topology = (await res.json()) as Topology
  return prepareWorld(topology)
}
