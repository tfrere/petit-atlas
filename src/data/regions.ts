import type { RegionId } from './types'

export interface RegionInfo {
  id: RegionId
  label: string
  /** [lonMin, latMin, lonMax, latMax] utilisé pour cadrer la carte (lonMax peut dépasser 180 au-dessus du Pacifique) */
  box: [number, number, number, number]
}

const WORLD_BOX: RegionInfo['box'] = [-180, -58, 180, 84]

export const REGIONS: RegionInfo[] = [
  { id: 'world', label: 'Monde', box: WORLD_BOX },
  { id: 'Europe', label: 'Europe', box: [-26, 34, 46, 71] },
  { id: 'Africa', label: 'Afrique', box: [-20, -36, 53, 38] },
  { id: 'Asia', label: 'Asie', box: [25, -11, 150, 56] },
  { id: 'Americas', label: 'Amériques', box: [-130, -56, -32, 62] },
  { id: 'Oceania', label: 'Océanie', box: [108, -48, 180, 2] },
  { id: 'Atlantic', label: 'Atlantique', box: [-98, -57, 24, 80] },
  { id: 'Pacific', label: 'Pacifique', box: [104, -57, 290, 62] },
  { id: 'Indian', label: 'Indien', box: [18, -52, 126, 30] },
  { id: 'planetary', label: 'Planétaires', box: WORLD_BOX },
]

export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id) ?? REGIONS[0]

/** Régions qui montrent la carte du monde entière, sans rien estomper. */
export const isWholeWorld = (id: RegionId) => id === 'world' || id === 'planetary'

const CONTINENT_IDS: RegionId[] = ['Europe', 'Africa', 'Asia', 'Americas', 'Oceania']
export const isContinent = (id: RegionId) => CONTINENT_IDS.includes(id)
