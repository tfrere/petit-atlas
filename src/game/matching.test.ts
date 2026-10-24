import { describe, expect, it } from 'vitest'
import { COUNTRIES } from '../data/world'
import { judge, normalize } from './matching'
import { countryPool, capitalPool } from './targets'

const country = (id: string, input: string) => judge(input, id, countryPool(COUNTRIES)).correct
const capital = (id: string, input: string) => judge(input, id, capitalPool(COUNTRIES)).correct

describe('normalize', () => {
  it('ignore casse, accents, ponctuation et articles', () => {
    expect(normalize("  L'Île  Maurice ")).toBe('ile maurice')
    expect(normalize('St-Marin')).toBe('saint marin')
  })
})

describe('pays', () => {
  it('accepte l’orthographe exacte, sans accent et avec de petites fautes', () => {
    expect(country('AUT', 'Autriche')).toBe(true)
    expect(country('CIV', "cote d'ivoire")).toBe(true)
    expect(country('AZE', 'azerbaidjan')).toBe(true)
    expect(country('KAZ', 'kazakstan')).toBe(true)
    expect(country('DEU', 'allemagn')).toBe(true)
    expect(country('USA', 'etats unis')).toBe(true)
    expect(country('COD', 'RDC')).toBe(true)
    expect(country('PRT', 'portugl')).toBe(true)
  })

  it('refuse les pays voisins ou ambigus', () => {
    expect(country('NGA', 'Niger')).toBe(false)
    expect(country('NER', 'Nigeria')).toBe(false)
    expect(country('ISL', 'Irlande')).toBe(false)
    expect(country('IRL', 'Islande')).toBe(false)
    expect(country('SDN', 'Soudan du Sud')).toBe(false)
    expect(country('SSD', 'Soudan')).toBe(false)
    expect(country('GIN', 'Guinée-Bissau')).toBe(false)
    expect(country('OMN', 'Iran')).toBe(false)
    expect(country('FRA', '')).toBe(false)
    expect(country('FRA', 'xyz')).toBe(false)
  })
})

describe('capitales', () => {
  it('accepte noms français, anglais et variantes', () => {
    expect(capital('AUT', 'vienne')).toBe(true)
    expect(capital('AUT', 'Vienna')).toBe(true)
    expect(capital('EGY', 'le caire')).toBe(true)
    expect(capital('UKR', 'Kyiv')).toBe(true)
    expect(capital('BOL', 'La Paz')).toBe(true)
    expect(capital('ZAF', 'le cap')).toBe(true)
    expect(capital('CHE', 'berne')).toBe(true)
  })

  it('refuse une autre capitale', () => {
    expect(capital('AUT', 'Berlin')).toBe(false)
    expect(capital('CHE', 'Vienne')).toBe(false)
  })
})

describe('cohérence des données', () => {
  it('chaque nom exact est accepté pour sa propre cible', () => {
    const cp = countryPool(COUNTRIES)
    const kp = capitalPool(COUNTRIES)
    const badCountries = COUNTRIES.filter((c) => !judge(c.name, c.id, cp).correct).map((c) => c.id)
    const badCapitals = COUNTRIES.flatMap((c) =>
      c.capitals.filter((k) => !judge(k.fr, c.id, kp).correct).map(() => c.id),
    )
    expect(badCountries).toEqual([])
    expect(badCapitals).toEqual([])
  })
})
