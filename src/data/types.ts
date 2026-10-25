export type Continent = 'Europe' | 'Africa' | 'Asia' | 'Americas' | 'Oceania'
export type OceanId = 'Atlantic' | 'Pacific' | 'Indian'
/** `planetary` regroupe les grands vents du globe (alizés, vents d'ouest, moussons…). */
export type RegionId = 'world' | Continent | OceanId | 'planetary'

export interface Capital {
  fr: string
  en: string
  aliases: string[]
  lon: number
  lat: number
}

export interface Country {
  id: string
  name: string
  aliases: string[]
  region: Continent
  regionFr: string
  area: number
  cityState: boolean
  lon: number
  lat: number
  capitals: Capital[]
}
