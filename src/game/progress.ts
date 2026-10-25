import { entriesOf } from './targets'
import type { PlayMode, TargetKind } from './targets'

const STORAGE_KEY = 'petit-atlas:progress:v1'

type Store = Record<string, string[]>

const modeKey = (target: TargetKind, mode: PlayMode) => `${target}.${mode}`

function readAll(): Store {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

/** Retient qu'un pays, une capitale, un courant ou un vent a déjà été trouvé dans ce mode, toutes régions confondues. */
export function markFound(target: TargetKind, mode: PlayMode, id: string) {
  const all = readAll()
  const key = modeKey(target, mode)
  const found = new Set(all[key] ?? [])
  if (found.has(id)) return
  found.add(id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [key]: [...found] }))
  } catch {
    /* stockage indisponible : la progression ne sera pas conservée */
  }
}

export interface Completion {
  found: number
  total: number
  percent: number
}

export function completion(target: TargetKind, mode: PlayMode): Completion {
  const eligible = new Set(entriesOf(target).map((e) => e.id))
  const found = (readAll()[modeKey(target, mode)] ?? []).filter((id) => eligible.has(id)).length
  const total = eligible.size
  return { found, total, percent: total ? Math.floor((found / total) * 100) : 0 }
}
