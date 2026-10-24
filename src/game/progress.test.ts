import { beforeEach, describe, expect, it } from 'vitest'
import { completion, markFound } from './progress'

beforeEach(() => {
  const data = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

describe('progression', () => {
  it('compte chaque pays une seule fois, par mode', () => {
    markFound('country', 'name', 'FRA')
    markFound('country', 'name', 'FRA')
    markFound('country', 'name', 'DEU')
    markFound('country', 'locate', 'FRA')
    expect(completion('country', 'name').found).toBe(2)
    expect(completion('country', 'locate').found).toBe(1)
    expect(completion('capital', 'name').found).toBe(0)
    expect(completion('country', 'name').total).toBe(194)
  })

  it('exclut les cités-États du total des capitales et ignore les ids inconnus', () => {
    markFound('capital', 'name', 'MCO')
    markFound('capital', 'name', 'FRA')
    const c = completion('capital', 'name')
    expect(c.total).toBe(191)
    expect(c.found).toBe(1)
  })
})
