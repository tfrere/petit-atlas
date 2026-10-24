export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\bst\b/g, 'saint')
    .replace(/\bste\b/g, 'sainte')
    .replace(/^(le|la|les|l|el|the|los|las) /, '')
}

export const matchKey = (input: string) => normalize(input).replace(/ /g, '')

/** Distance de Damerau-Levenshtein (transposition adjacente = 1 erreur). */
export function editDistance(a: string, b: string, limit = Infinity): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  const rows = [new Array<number>(b.length + 1), new Array<number>(b.length + 1), new Array<number>(b.length + 1)]
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    const cur = rows[i % 3]
    const prev = rows[(i - 1) % 3]
    const prev2 = rows[(i - 2 + 3) % 3]
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
    }
  }
  return rows[a.length % 3][b.length]
}

/** Nombre de fautes de frappe tolérées selon la longueur du nom attendu. */
export function tolerance(length: number): number {
  if (length <= 3) return 0
  if (length <= 5) return 1
  if (length <= 9) return 2
  return 3
}

export interface Candidate {
  id: string
  names: string[]
}

export interface Verdict {
  correct: boolean
  /** Entité la plus proche de la saisie, même si elle est fausse (utile pour l'afficher). */
  closestId: string | null
}

/**
 * Une saisie est correcte si l'entité la plus proche est la cible, à moins de `tolerance` fautes,
 * et strictement plus proche que toutes les autres (« Niger » ne doit pas valider « Nigeria »).
 */
export function judge(input: string, targetId: string, pool: Candidate[]): Verdict {
  const q = matchKey(input)
  if (!q) return { correct: false, closestId: null }

  let bestId: string | null = null
  let bestDist = Infinity
  let targetDist = Infinity
  let targetTol = 0
  let runnerUp = Infinity

  for (const entity of pool) {
    let d = Infinity
    let tol = 0
    for (const name of entity.names) {
      const key = matchKey(name)
      const nameTol = tolerance(key.length)
      const nd = editDistance(q, key, Math.max(nameTol, 3))
      if (nd < d || (nd === d && nameTol > tol)) {
        d = nd
        tol = nameTol
      }
    }
    if (entity.id === targetId) {
      targetDist = d
      targetTol = tol
    }
    if (d < bestDist) {
      runnerUp = bestDist
      bestDist = d
      bestId = entity.id
    } else if (d < runnerUp) {
      runnerUp = d
    }
  }

  const others = bestId === targetId ? runnerUp : bestDist
  const correct = targetDist <= targetTol && (targetDist === 0 || targetDist < others)
  return { correct, closestId: bestId }
}
