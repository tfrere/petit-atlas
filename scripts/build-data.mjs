// Génère src/data/countries.json et public/data/world.json à partir de sources ouvertes :
//  - mledoze/countries (ISO 3166-1, noms français, régions)
//  - Wikidata (capitales : nom français + coordonnées)
//  - Natural Earth via world-atlas (géométries 1:50m)
// Usage : node scripts/build-data.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const COUNTRIES_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'
const SPARQL_URL = 'https://query.wikidata.org/sparql'
const UA = 'petit-atlas-data-build/0.1 (https://github.com)'

const SPARQL = `
SELECT ?iso3 ?cap ?capFr ?capEn ?coord ?rank WHERE {
  ?c wdt:P298 ?iso3 .
  ?c p:P36 ?st .
  ?st ps:P36 ?cap .
  ?st wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  FILTER NOT EXISTS { ?st pq:P582 ?end }
  OPTIONAL { ?cap rdfs:label ?capFr FILTER(lang(?capFr)="fr") }
  OPTIONAL { ?cap rdfs:label ?capEn FILTER(lang(?capEn)="en") }
  OPTIONAL { ?cap wdt:P625 ?coord }
}`

const NAME_OVERRIDES = {
  COD: 'RD Congo',
  CPV: 'Cap-Vert',
  PLW: 'Palaos',
  MUS: 'Maurice',
  SLV: 'Salvador',
  VAT: 'Vatican',
  KNA: 'Saint-Christophe-et-Niévès',
  SAU: 'Arabie saoudite',
}

const NAME_ALIASES = {
  USA: ['États-Unis d’Amérique', 'USA', 'US'],
  GBR: ['Grande-Bretagne', 'UK', 'Angleterre'],
  COD: ['RDC', 'Congo-Kinshasa', 'République démocratique du Congo'],
  COG: ['Congo-Brazzaville', 'République du Congo'],
  MMR: ['Myanmar'],
  CZE: ['République tchèque', 'Tchéquie'],
  SWZ: ['Swaziland'],
  CPV: ['Cabo Verde', 'Îles du Cap-Vert'],
  CIV: ['Cote d’Ivoire'],
  TLS: ['Timor-Leste'],
  MKD: ['Macédoine'],
  ARE: ['EAU'],
  BIH: ['Bosnie'],
  VAT: ['Saint-Siège', 'Cité du Vatican'],
  STP: ['Sao Tomé-et-Principe', 'Sao Tomé'],
  SLV: ['El Salvador'],
  PLW: ['Palau'],
  MUS: ['Île Maurice'],
  VNM: ['Vietnam'],
  BRN: ['Brunei Darussalam'],
  FSM: ['États fédérés de Micronésie'],
  KNA: ['Saint-Kitts-et-Nevis', 'Saint-Kitts'],
  VCT: ['Saint-Vincent'],
  NGA: ['Nigeria'],
  BLR: ['Bélarus', 'Belarus'],
  TTO: ['Trinité'],
  PRK: ['Corée du Nord'],
  KOR: ['Corée du Sud'],
}

const CAPITAL_PRIMARY = {
  BEN: 'Porto-Novo',
  BOL: 'Sucre',
  LKA: 'Sri Jayawardenepura Kotte',
  MYS: 'Kuala Lumpur',
  SWZ: 'Mbabane',
  YEM: 'Sanaa',
  ZAF: 'Pretoria',
}

const CAPITAL_ALIASES = {
  UKR: ['Kyiv', 'Kiev'],
  MMR: ['Nay Pyi Taw', 'Naypyidaw'],
  MEX: ['Mexico City', 'Ville de Mexico'],
  KIR: ['Tarawa'],
  LKA: ['Kotte', 'Sri Jayawardenapura'],
  ATG: ['Saint-Jean', 'St. John’s'],
  BRA: ['Brasília'],
  KAZ: ['Nur-Sultan'],
  COL: ['Bogotá'],
  GNQ: ['Malabo'],
  BTN: ['Thimphu'],
  USA: ['Washington DC', 'Washington D.C.'],
  VNM: ['Hanoi'],
}

const CAPITAL_FR_OVERRIDES = {
  LKA: { 'Sri Jayawardenepura Kotte': 'Sri Jayawardenepura Kotte' },
}

const TOPO_ID_REMAP = {
  Somaliland: 'SOM',
  'N. Cyprus': 'CYP',
  'Siachen Glacier': 'IND',
  Kosovo: 'XKX',
  'Indian Ocean Ter.': 'IOT',
}

const REGION_FR = {
  Africa: 'Afrique',
  Americas: 'Amériques',
  Asia: 'Asie',
  Europe: 'Europe',
  Oceania: 'Océanie',
}

async function getJson(url, init) {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

function parsePoint(wkt) {
  const m = /Point\(([-\d.eE+]+) ([-\d.eE+]+)\)/.exec(wkt ?? '')
  return m ? [Number(m[1]), Number(m[2])] : null
}

const round = (n, d = 3) => Number(n.toFixed(d))

function haversineKm([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}

const [countries, atlas, wd] = await Promise.all([
  getJson(COUNTRIES_URL),
  getJson(ATLAS_URL),
  getJson(`${SPARQL_URL}?query=${encodeURIComponent(SPARQL)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  }),
])

const capsByIso = new Map()
for (const b of wd.results.bindings) {
  const iso = b.iso3.value
  const coord = parsePoint(b.coord?.value)
  if (!coord) continue
  const qid = b.cap.value.split('/').pop()
  const list = capsByIso.get(iso) ?? []
  if (list.some((c) => c.qid === qid)) continue
  list.push({
    qid,
    fr: b.capFr?.value,
    en: b.capEn?.value,
    coord,
    preferred: b.rank.value.endsWith('PreferredRank'),
  })
  capsByIso.set(iso, list)
}

const sovereign = countries.filter((c) => c.independent)
const out = []
const warnings = []

for (const c of sovereign) {
  const iso = c.cca3
  const cands = capsByIso.get(iso)
  if (!cands?.length) {
    warnings.push(`${iso}: aucune capitale Wikidata`)
    continue
  }
  const wanted = CAPITAL_PRIMARY[iso]
  const mledozeEn = c.capital?.[0]
  const primary =
    cands.find((x) => wanted && x.en === wanted) ??
    cands.find((x) => x.preferred) ??
    cands.find((x) => x.en === mledozeEn) ??
    cands[0]
  const ordered = [primary, ...cands.filter((x) => x !== primary)]

  const capitals = ordered.map((x) => {
    const en = x.en ?? mledozeEn
    const fr = CAPITAL_FR_OVERRIDES[iso]?.[en] ?? x.fr ?? en
    return {
      fr,
      en,
      aliases: [
        ...new Set([en, x.fr, ...(x === primary ? (CAPITAL_ALIASES[iso] ?? []) : [])].filter((n) => n && n !== fr)),
      ],
      lon: round(x.coord[0]),
      lat: round(x.coord[1]),
    }
  })

  const dist = haversineKm([c.latlng[1], c.latlng[0]], [capitals[0].lon, capitals[0].lat])
  if (dist > 4000) warnings.push(`${iso}: capitale à ${Math.round(dist)} km du centre du pays`)

  const nameFr = NAME_OVERRIDES[iso] ?? c.translations.fra.common
  const aliases = [
    ...new Set(
      [c.translations.fra.official, c.name.common, c.name.official, ...(NAME_ALIASES[iso] ?? [])].filter(
        (n) => n && n !== nameFr,
      ),
    ),
  ]

  out.push({
    id: iso,
    name: nameFr,
    aliases,
    region: c.region,
    regionFr: REGION_FR[c.region] ?? c.region,
    area: Math.round(c.area),
    cityState: ['MCO', 'SGP', 'VAT'].includes(iso),
    lon: round(c.latlng[1]),
    lat: round(c.latlng[0]),
    capitals,
  })
}

out.sort((a, b) => a.name.localeCompare(b.name, 'fr'))

const numToIso = new Map(countries.map((c) => [c.ccn3, c.cca3]))
const geoms = atlas.objects.countries.geometries
const unmatched = []
for (const g of geoms) {
  const name = g.properties?.name
  if (g.id && numToIso.has(g.id)) g.id = numToIso.get(g.id)
  else if (TOPO_ID_REMAP[name]) g.id = TOPO_ID_REMAP[name]
  else {
    unmatched.push(name)
    g.id = `X-${name}`
  }
}
const present = new Set(geoms.map((g) => g.id))
for (const c of out) if (!present.has(c.id)) warnings.push(`${c.id}: pas de géométrie (affiché en pastille)`)
delete atlas.objects.land

await mkdir(resolve(root, 'src/data'), { recursive: true })
await mkdir(resolve(root, 'public/data'), { recursive: true })
await writeFile(resolve(root, 'src/data/countries.json'), JSON.stringify(out, null, 1) + '\n')
await writeFile(resolve(root, 'public/data/world.json'), JSON.stringify(atlas))

console.log(`${out.length} pays, ${out.reduce((n, c) => n + c.capitals.length, 0)} capitales`)
console.log('géométries sans pays :', unmatched.join(', ') || 'aucune')
if (warnings.length) console.log('Avertissements :\n- ' + warnings.join('\n- '))
