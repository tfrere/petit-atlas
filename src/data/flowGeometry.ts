import { FLOW_BY_ID } from './flows'

export type LonLat = [number, number]

/** Écart de points d'un tracé lissé, en degrés. */
const STEP_DEG = 1

function chord(a: LonLat, b: LonLat) {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/** Spline de Catmull-Rom centripète : évite les boucles et les dépassements entre points inégalement espacés. */
function spline(p0: LonLat, p1: LonLat, p2: LonLat, p3: LonLat, steps: number): LonLat[] {
  const t0 = 0
  const t1 = t0 + Math.sqrt(chord(p0, p1))
  const t2 = t1 + Math.sqrt(chord(p1, p2))
  const t3 = t2 + Math.sqrt(chord(p2, p3))
  const mix = (a: LonLat, b: LonLat, ta: number, tb: number, t: number): LonLat => {
    const w = (t - ta) / (tb - ta)
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]
  }
  const out: LonLat[] = []
  for (let i = 0; i < steps; i++) {
    const t = t1 + ((t2 - t1) * i) / steps
    const a1 = mix(p0, p1, t0, t1, t)
    const a2 = mix(p1, p2, t1, t2, t)
    const a3 = mix(p2, p3, t2, t3, t)
    const b1 = mix(a1, a2, t0, t2, t)
    const b2 = mix(a2, a3, t1, t3, t)
    out.push(mix(b1, b2, t1, t2, t))
  }
  return out
}

/** Lisse un tracé à points de contrôle ; la dernière position est conservée. */
export function smoothPath(path: LonLat[]): LonLat[] {
  if (path.length < 3) return path
  const first: LonLat = [2 * path[0][0] - path[1][0], 2 * path[0][1] - path[1][1]]
  const n = path.length
  const last: LonLat = [2 * path[n - 1][0] - path[n - 2][0], 2 * path[n - 1][1] - path[n - 2][1]]
  const pts = [first, ...path, last]
  const out: LonLat[] = []
  for (let i = 1; i < pts.length - 2; i++) {
    const steps = Math.max(3, Math.ceil(chord(pts[i], pts[i + 1]) / STEP_DEG))
    out.push(...spline(pts[i - 1], pts[i], pts[i + 1], pts[i + 2], steps))
  }
  out.push(path[n - 1])
  return out
}

export function distanceKm(a: LonLat, b: LonLat) {
  const r = Math.PI / 180
  const h =
    Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface FlowGeometry {
  id: string
  paths: LonLat[][]
  /** Point d'ancrage de l'étiquette, au milieu du tracé le plus long. */
  anchor: LonLat
}

const cache = new Map<string, FlowGeometry>()

export function flowGeometry(id: string): FlowGeometry | null {
  const hit = cache.get(id)
  if (hit) return hit
  const flow = FLOW_BY_ID.get(id)
  if (!flow) return null
  const paths = flow.paths.map(smoothPath)
  const lengthOf = (p: LonLat[]) => p.reduce((sum, pt, i) => (i ? sum + chord(p[i - 1], pt) : 0), 0)
  const longest = paths.reduce((a, b) => (lengthOf(b) > lengthOf(a) ? b : a))
  const geometry = { id, paths, anchor: longest[Math.floor(longest.length / 2)] }
  cache.set(id, geometry)
  return geometry
}

export interface FlowHit {
  id: string
  km: number
  /** Point du tracé le plus proche de la position touchée. */
  at: LonLat
}

/** Distance entre une position et un tracé, avec le point du tracé le plus proche. */
export function distanceToFlow(at: LonLat, id: string): FlowHit | null {
  const g = flowGeometry(id)
  if (!g) return null
  let best: FlowHit | null = null
  for (const path of g.paths) {
    for (const pt of path) {
      const km = distanceKm(at, pt)
      if (!best || km < best.km) best = { id, km, at: pt }
    }
  }
  return best
}
