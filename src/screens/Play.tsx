import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import { COUNTRIES } from '../data/world'
import type { WorldData } from '../data/world'
import { judge } from '../game/matching'
import { formatTime } from '../game/records'
import type { GameConfig } from '../game/records'
import { TARGETS, buildQuestions } from '../game/targets'
import type { Question } from '../game/targets'
import WorldMap from '../map/WorldMap'
import type { HighlightKind, MapLabel, MapMarker, MapView, TapInfo } from '../map/WorldMap'
import { fontDisplay, tokens } from '../theme'

export interface Answer {
  question: Question
  ok: boolean
  given?: string
}

export interface GameResult {
  rawMs: number
  answers: Answer[]
}

interface Props {
  world: WorldData
  config: GameConfig
  onExit: () => void
  onFinish: (result: GameResult) => void
}

type Phase = 'asking' | 'correct' | 'wrong'

interface Reveal {
  tappedId?: string | null
  tapped?: { lon: number; lat: number }
  km?: number
}

const CAPITAL_TOLERANCE_KM = 250
const AUTO_ADVANCE_MS = 850

function distanceKm(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180
  const h =
    Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

function makeNameView(world: WorldData, question: Question, key: number): MapView {
  const hasShape = world.byId.has(question.id)
  const usePoints = question.kind === 'capital' || !hasShape
  return {
    key: `q${key}`,
    ids: hasShape ? [question.id] : undefined,
    points: usePoints ? question.points.map((p) => [p.lon, p.lat] as [number, number]) : undefined,
  }
}

function useStopwatch() {
  const acc = useRef(0)
  const startedAt = useRef<number | null>(null)

  const read = useCallback(
    () => acc.current + (startedAt.current === null ? 0 : performance.now() - startedAt.current),
    [],
  )
  const resume = useCallback(() => {
    if (startedAt.current === null) startedAt.current = performance.now()
  }, [])
  const pause = useCallback(() => {
    if (startedAt.current !== null) {
      acc.current += performance.now() - startedAt.current
      startedAt.current = null
    }
  }, [])

  return { resume, pause, read }
}

function Chrono({ read }: { read: () => number }) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setMs(read()), 100)
    return () => window.clearInterval(id)
  }, [read])
  return <Stat label="Chrono" value={formatTime(ms)} />
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 52 }}>
      <Typography sx={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: '1.35rem', lineHeight: 1, color }}>
        {value}
      </Typography>
      <Typography
        variant="overline"
        sx={{ fontSize: '0.62rem', color: tokens.inkSoft, lineHeight: 1.2, display: 'block' }}
      >
        {label}
      </Typography>
    </Box>
  )
}

export default function Play({ world, config, onExit, onFinish }: Props) {
  const questions = useMemo(
    () => buildQuestions(config.target, config.region, config.count, COUNTRIES),
    [config.target, config.region, config.count],
  )
  const pool = useMemo(() => TARGETS[config.target].pool(COUNTRIES), [config.target])

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('asking')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [reveal, setReveal] = useState<Reveal>({})
  const [text, setText] = useState('')
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [view, setView] = useState<MapView>(() =>
    config.mode === 'name' ? makeNameView(world, questions[0], 0) : { key: 'start' },
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const advanceTimer = useRef<number | null>(null)
  const watch = useStopwatch()
  const { resume, pause } = watch

  const q = questions[index]
  const errors = answers.filter((a) => !a.ok).length
  const locate = config.mode === 'locate'

  useEffect(() => {
    resume()
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    }
    // démarrage unique du chrono
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishOrNext = useCallback(
    (list: Answer[]) => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
      const next = index + 1
      if (next >= questions.length) {
        onFinish({ rawMs: watch.read(), answers: list })
        return
      }
      const lastWrong = !list[list.length - 1].ok
      setIndex(next)
      setPhase('asking')
      setReveal({})
      setText('')
      if (locate) {
        if (lastWrong) setView({ key: `reset${next}` })
      } else {
        setView(makeNameView(world, questions[next], next))
      }
      resume()
      inputRef.current?.focus()
    },
    [index, questions, locate, world, onFinish, resume, watch],
  )

  const record = useCallback(
    (ok: boolean, extra: Reveal = {}, given?: string) => {
      pause()
      const list = [...answers, { question: q, ok, given }]
      setAnswers(list)
      setReveal(extra)
      setPhase(ok ? 'correct' : 'wrong')
      if (ok) {
        advanceTimer.current = window.setTimeout(() => finishOrNext(list), AUTO_ADVANCE_MS)
      } else if (locate) {
        const pts: [number, number][] = q.points.map((p) => [p.lon, p.lat])
        if (extra.tapped && q.kind === 'capital') pts.push([extra.tapped.lon, extra.tapped.lat])
        setView({
          key: `reveal${index}`,
          ids: q.kind === 'country' && world.byId.has(q.id) ? [q.id] : undefined,
          points: q.kind === 'capital' || !world.byId.has(q.id) ? pts : undefined,
          minSpan: q.kind === 'capital' ? 0.09 : 0.07,
        })
      }
    },
    [answers, finishOrNext, index, locate, pause, q, world],
  )

  const submitText = () => {
    if (phase !== 'asking') {
      finishOrNext(answers)
      return
    }
    if (!text.trim()) return
    const verdict = judge(text, q.id, pool)
    record(verdict.correct, {}, text.trim())
  }

  const skip = () => {
    if (phase === 'asking') record(false, {}, undefined)
  }

  const handleTap = (tap: TapInfo) => {
    if (!locate || phase !== 'asking') return
    if (q.kind === 'country') {
      if (!tap.id) return
      record(tap.id === q.id, { tappedId: tap.id })
    } else {
      if (tap.lon === null || tap.lat === null) return
      const km = Math.min(...q.points.map((p) => distanceKm([tap.lon!, tap.lat!], [p.lon, p.lat])))
      const nearest = q.points.reduce((a, b) =>
        distanceKm([tap.lon!, tap.lat!], [a.lon, a.lat]) <= distanceKm([tap.lon!, tap.lat!], [b.lon, b.lat]) ? a : b,
      )
      record(km <= CAPITAL_TOLERANCE_KM, { tapped: { lon: tap.lon, lat: tap.lat }, km }, nearest.label)
    }
  }

  const highlights = useMemo(() => {
    const h: Record<string, HighlightKind> = {}
    if (!q) return h
    if (!locate) {
      h[q.id] = phase === 'asking' ? 'target' : phase === 'correct' ? 'correct' : 'wrong'
    } else if (phase === 'correct') {
      if (q.kind === 'country') h[q.id] = 'correct'
    } else if (phase === 'wrong') {
      if (q.kind === 'country') {
        if (reveal.tappedId && reveal.tappedId !== q.id) h[reveal.tappedId] = 'wrong'
        h[q.id] = 'correct'
      }
    }
    return h
  }, [q, locate, phase, reveal.tappedId])

  const markers = useMemo<MapMarker[]>(() => {
    if (!q) return []
    const list: MapMarker[] = []
    const showStar = q.kind === 'capital' && (!locate || phase !== 'asking')
    if (showStar) q.points.forEach((p) => list.push({ lon: p.lon, lat: p.lat, kind: 'star' }))
    if (locate && q.kind === 'capital' && reveal.tapped) list.push({ ...reveal.tapped, kind: 'guess' })
    return list
  }, [q, locate, phase, reveal.tapped])

  const labels = useMemo<MapLabel[]>(() => {
    if (!q || phase === 'asking') return []
    const list: MapLabel[] = []
    if (q.kind === 'capital') {
      q.points.slice(0, 1).forEach((p) => list.push({ lon: p.lon, lat: p.lat, text: p.label, dy: 26 }))
      if (locate && reveal.km !== undefined && reveal.tapped) {
        list.push({
          lon: reveal.tapped.lon,
          lat: reveal.tapped.lat,
          text: `${Math.round(reveal.km).toLocaleString('fr-FR')} km`,
          dy: -14,
        })
      }
    } else {
      const s = world.byId.get(q.id)
      const c = s?.centroid ?? [q.points[0].lon, q.points[0].lat]
      list.push({ lon: c[0], lat: c[1], text: q.label })
      if (reveal.tappedId && reveal.tappedId !== q.id) {
        const t = world.byId.get(reveal.tappedId)
        if (t) list.push({ lon: t.centroid[0], lat: t.centroid[1], text: t.name })
      }
    }
    return list
  }, [q, phase, reveal, locate, world])

  const line = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!q || !locate || q.kind !== 'capital' || phase === 'asking' || !reveal.tapped) return null
    const nearest = q.points.reduce((a, b) =>
      distanceKm([reveal.tapped!.lon, reveal.tapped!.lat], [a.lon, a.lat]) <=
      distanceKm([reveal.tapped!.lon, reveal.tapped!.lat], [b.lon, b.lat])
        ? a
        : b,
    )
    return [
      [reveal.tapped.lon, reveal.tapped.lat],
      [nearest.lon, nearest.lat],
    ]
  }, [q, locate, phase, reveal.tapped])

  const closeQuit = () => {
    setConfirmQuit(false)
    if (phase === 'asking') resume()
  }

  if (!q) return null

  const prompt = locate
    ? q.kind === 'country'
      ? 'Situe ce pays'
      : 'Situe cette capitale'
    : q.kind === 'country'
      ? 'Quel est ce pays ?'
      : 'Quelle est cette capitale ?'

  const lastGiven = answers[answers.length - 1]?.given
  const wrongDetail =
    phase === 'wrong'
      ? locate
        ? q.kind === 'country'
          ? reveal.tappedId
            ? `Tu as touché : ${world.byId.get(reveal.tappedId)?.name ?? '—'}`
            : null
          : reveal.km !== undefined
            ? `Tu étais à ${Math.round(reveal.km).toLocaleString('fr-FR')} km`
            : null
        : lastGiven
          ? `Tu as écrit : ${lastGiven}`
          : 'Passé'
      : null

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        height: 'var(--app-h, 100dvh)',
        display: 'flex',
        flexDirection: 'column',
        pt: 'env(safe-area-inset-top)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1,
          py: 0.75,
          background: tokens.paper,
          borderBottom: `1.5px solid ${tokens.ink}`,
        }}
      >
        <Button
          onClick={() => {
            pause()
            setConfirmQuit(true)
          }}
          aria-label="Abandonner"
          sx={{ minWidth: 44, minHeight: 44, color: tokens.ink, fontSize: '1.4rem', px: 0 }}
        >
          ✕
        </Button>
        <Stat label="Question" value={`${index + 1}/${questions.length}`} />
        <Stat label="Erreurs" value={String(errors)} color={errors ? tokens.wrong : undefined} />
        <Chrono read={watch.read} />
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1,
          textAlign: 'center',
          background: tokens.paper,
          borderBottom: `4px double ${tokens.ink}`,
          minHeight: locate ? 78 : 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="overline" sx={{ color: tokens.brick, lineHeight: 1.2 }}>
          {prompt}
        </Typography>
        {locate && (
          <Typography
            sx={{
              fontFamily: fontDisplay,
              fontWeight: 700,
              fontSize: 'clamp(1.7rem, 7vw, 2.4rem)',
              lineHeight: 1.05,
              color: phase === 'correct' ? tokens.sage : phase === 'wrong' ? tokens.wrong : tokens.ink,
            }}
          >
            {q.label}
          </Typography>
        )}
      </Box>

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <WorldMap
          world={world}
          region={config.region}
          highlights={highlights}
          markers={markers}
          labels={labels}
          line={line}
          view={view}
          onTap={handleTap}
          tapRings={locate}
          interactive
        />

        {locate && phase === 'wrong' && (
          <Box
            sx={{
              position: 'absolute',
              left: 8,
              right: 8,
              top: 8,
              p: 1.5,
              background: 'rgba(247,239,219,.97)',
              border: `1.5px solid ${tokens.ink}`,
              boxShadow: `3px 3px 0 ${tokens.ink}`,
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.1 }}>
                C’était : {q.label}
              </Typography>
              {wrongDetail && (
                <Typography sx={{ color: tokens.inkSoft, fontSize: '0.95rem' }}>{wrongDetail}</Typography>
              )}
            </Box>
            <Button variant="contained" autoFocus onClick={() => finishOrNext(answers)}>
              Continuer
            </Button>
          </Box>
        )}
      </Box>

      {!locate && (
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            submitText()
          }}
          sx={{
            background: tokens.paper,
            borderTop: `4px double ${tokens.ink}`,
            px: 1.5,
            pt: 1.25,
            pb: 'max(10px, env(safe-area-inset-bottom))',
          }}
        >
          <Box sx={{ maxWidth: 640, mx: 'auto' }}>
            {phase !== 'asking' && (
              <Typography
                sx={{
                  fontFamily: fontDisplay,
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  lineHeight: 1.15,
                  mb: 0.75,
                  color: phase === 'correct' ? tokens.sage : tokens.wrong,
                }}
              >
                {phase === 'correct' ? `Exact : ${q.label}` : `C’était : ${q.label}`}
                {phase === 'wrong' && wrongDetail && (
                  <Typography
                    component="span"
                    sx={{
                      display: 'block',
                      fontSize: '0.9rem',
                      fontWeight: 400,
                      color: tokens.inkSoft,
                      fontFamily: 'inherit',
                    }}
                  >
                    {wrongDetail}
                  </Typography>
                )}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box
                component="input"
                ref={inputRef}
                value={text}
                readOnly={phase !== 'asking'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
                placeholder={q.kind === 'country' ? 'Nom du pays…' : 'Nom de la capitale…'}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Ta réponse"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  height: 52,
                  px: 1.5,
                  fontFamily: fontDisplay,
                  fontWeight: 700,
                  fontSize: '1.45rem',
                  color: phase === 'correct' ? tokens.sage : phase === 'wrong' ? tokens.wrong : tokens.ink,
                  background: '#fbf5e6',
                  border: `1.5px solid ${tokens.ink}`,
                  borderRadius: '3px',
                  outline: 'none',
                  '&:focus': { boxShadow: `0 0 0 3px rgba(180,71,42,.35)` },
                  '&::placeholder': { color: 'rgba(93,76,55,.55)', fontWeight: 600, fontStyle: 'italic' },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                onMouseDown={(e) => e.preventDefault()}
                sx={{ minWidth: 104, height: 52 }}
              >
                {phase === 'asking' ? 'Valider' : 'Suite'}
              </Button>
            </Box>
            {phase === 'asking' && (
              <Button
                onMouseDown={(e) => e.preventDefault()}
                onClick={skip}
                sx={{ mt: 0.5, minHeight: 36, color: tokens.inkSoft, textDecoration: 'underline', fontSize: '0.95rem' }}
              >
                Je passe
              </Button>
            )}
          </Box>
        </Box>
      )}

      <Dialog open={confirmQuit} onClose={closeQuit}>
        <DialogTitle sx={{ fontFamily: fontDisplay, fontWeight: 700 }}>Abandonner la série ?</DialogTitle>
        <DialogContent>
          <DialogContentText>Le chrono et la progression seront perdus.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button variant="outlined" onClick={closeQuit}>
            Continuer
          </Button>
          <Button variant="contained" onClick={onExit}>
            Abandonner
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
