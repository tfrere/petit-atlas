export type RegionId = 'world' | 'Europe' | 'Africa' | 'Asia' | 'Americas' | 'Oceania'

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
  region: Exclude<RegionId, 'world'>
  regionFr: string
  area: number
  cityState: boolean
  lon: number
  lat: number
  capitals: Capital[]
}
