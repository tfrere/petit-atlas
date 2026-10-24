const FACES = [
  '500 1em "Cormorant Garamond"',
  'italic 500 1em "Cormorant Garamond"',
  '600 1em "Cormorant Garamond"',
  'italic 600 1em "Cormorant Garamond"',
  '700 1em "Cormorant Garamond"',
  'italic 700 1em "Cormorant Garamond"',
  '400 1em "IBM Plex Mono"',
  'italic 400 1em "IBM Plex Mono"',
  '500 1em "IBM Plex Mono"',
  '600 1em "IBM Plex Mono"',
]

const SAMPLE = 'Le Petit Atlas — éèêàçôûîœ ÉÈ 0123456789'

/** Charge toutes les graisses de police utilisées ; ne bloque jamais plus de `timeoutMs`. */
export function loadFonts(timeoutMs = 5000): Promise<void> {
  if (!('fonts' in document)) return Promise.resolve()
  const all = Promise.all(FACES.map((f) => document.fonts.load(f, SAMPLE))).then(() => document.fonts.ready)
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))
  return Promise.race([all.then(() => undefined), timeout])
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
