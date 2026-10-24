import type { RegionId } from '../data/types'
import type { PlayMode, TargetKind } from './targets'

export interface GameConfig {
  target: TargetKind
  mode: PlayMode
  region: RegionId
  /** 0 = toutes les questions de la région */
  count: number
}

export interface RecordEntry {
  ms: number
  errors: number
  at: number
}

export const PENALTY_MS = 5000
const STORAGE_KEY = 'petit-atlas:records:v1'
const CONFIG_KEY = 'petit-atlas:config:v1'

export const configKey = (c: GameConfig) => `${c.target}.${c.mode}.${c.region}.${c.count}`

function readAll(): Record<string, RecordEntry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, RecordEntry>
  } catch {
    return {}
  }
}

export function getRecord(c: GameConfig): RecordEntry | null {
  return readAll()[configKey(c)] ?? null
}

export function saveIfRecord(c: GameConfig, entry: RecordEntry): { isRecord: boolean; previous: RecordEntry | null } {
  const all = readAll()
  const previous = all[configKey(c)] ?? null
  const isRecord = !previous || entry.ms < previous.ms
  if (isRecord) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [configKey(c)]: entry }))
    } catch {
      /* stockage indisponible : le record ne sera pas conservé */
    }
  }
  return { isRecord, previous }
}

export const DEFAULT_CONFIG: GameConfig = { target: 'country', mode: 'name', region: 'world', count: 20 }

export function loadConfig(): GameConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') as Partial<GameConfig> | null
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function storeConfig(c: GameConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  } catch {
    /* ignoré */
  }
}

export function formatTime(ms: number): string {
  const total = Math.max(0, ms)
  const minutes = Math.floor(total / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const tenths = Math.floor((total % 1000) / 100)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}
