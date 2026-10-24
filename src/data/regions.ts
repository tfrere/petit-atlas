import type { RegionId } from './types'

export interface RegionInfo {
  id: RegionId
  label: string
  /** [lonMin, latMin, lonMax, latMax] utilisé pour cadrer la carte */
  box: [number, number, number, number]
}

export const REGIONS: RegionInfo[] = [
  { id: 'world', label: 'Monde', box: [-180, -58, 180, 84] },
  { id: 'Europe', label: 'Europe', box: [-26, 34, 46, 71] },
  { id: 'Africa', label: 'Afrique', box: [-20, -36, 53, 38] },
  { id: 'Asia', label: 'Asie', box: [25, -11, 150, 56] },
  { id: 'Americas', label: 'Amériques', box: [-130, -56, -32, 62] },
  { id: 'Oceania', label: 'Océanie', box: [108, -48, 180, 2] },
]

export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id) ?? REGIONS[0]
