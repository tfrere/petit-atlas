import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import { flowGeometry } from '../data/flowGeometry'
import { FLOW_BY_ID } from '../data/flows'
import type { WorldData } from '../data/world'
import { judgeFlowTap } from '../game/flows'
import { judge } from '../game/matching'
import { markFound } from '../game/progress'
import type { GameConfig } from '../game/records'
import { TARGETS, buildQuestions, candidatesOf, isFlowKind, poolFor } from '../game/targets'
import type { Question, TargetKind } from '../game/targets'
import Hud from '../ui/Hud'
import WorldMap from '../map/WorldMap'
import type { HighlightKind, MapFlow, MapLabel, MapMarker, MapView, TapInfo } from '../map/WorldMap'
import { doubleRule, fontDisplay, tokens } from '../theme'

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

interface Selection {
  id?: string
  lon?: number
  lat?: number
}

interface Reveal {
  timeout?: boolean
  tappedId?: string | null
  tapped?: { lon: number; lat: number }
  km?: number
  /** Courants et vents : point du tracé cherché le plus proche du toucher. */
  at?: [number, number]
  /** Courants et vents : autre tracé désigné par erreur. */
  otherId?: string | null
}

const HALO = [
  [-1.5, 0],
  [1.5, 0],
  [0, -1.5],
  [0, 1.5],
  [-1.1, -1.1],
  [1.1, -1.1],
  [-1.1, 1.1],
  [1.1, 1.1],
]
const halo = {
  textShadow: `${HALO.map(([x, y]) => `${x}px ${y}px 0 rgba(255,255,255,.95)`).join(', ')}, 0 0 6px rgba(255,255,255,.9)`,
}

const CAPITAL_TOLERANCE_KM = 250
/** Un toucher plus loin qu'une telle distance d'un tracé n'est pas inclus dans le cadrage de la correction. */
const FRAME_TAP_KM = 2500
const TIME_LIMIT_MS = { name: 20_000, locate: 15_000 }
const FEEDBACK_GUARD_MS = 450

function distanceKm(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180
  const h =
    Math.sin(((b[1] - a[1]) * r) / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

const flowView = (kind: TargetKind) => (kind === 'wind' ? { minSpan: 0.06, pad: 1.6 } : { minSpan: 0.14, pad: 1.7 })

function makeNameView(world: WorldData, question: Question, key: number): MapView {
  if (isFlowKind(question.kind)) return { key: `q${key}`, flows: [question.id], ...flowView(question.kind) }
  const hasShape = world.byId.has(question.id)
  const usePoints = question.kind === 'capital' || !hasShape
  return {
    key: `q${key}`,
    ids: hasShape ? [question.id] : undefined,
    points: usePoints ? question.points.map((p) => [p.lon, p.lat] as [number, number]) : undefined,
  }
}

function FlowNote({ question }: { question: Question }) {
  return (
    <Box sx={{ mt: 0.25 }}>
      <Typography
        variant="overline"
        sx={{
          display: 'block',
          fontSize: '0.6rem',
          lineHeight: 1.5,
          color: question.temp === 'cold' ? tokens.cold : tokens.brickDark,
        }}
      >
        {question.context}
      </Typography>
      <Typography sx={{ color: tokens.ink, fontSize: '0.78rem', lineHeight: 1.3 }}>{question.note}</Typography>
    </Box>
  )
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
  const reset = useCallback(() => {
    acc.current = 0
    startedAt.current = null
  }, [])

  return { resume, pause, read, reset }
}

export default function Play({ world, config, onExit, onFinish }: Props) {
  const questions = useMemo(
    () => buildQuestions(config.target, config.region, config.count),
    [config.target, config.region, config.count],
  )
  const pool = useMemo(() => candidatesOf(config.target), [config.target])
  const poolIds = useMemo(() => poolFor(config.target, config.region).map((e) => e.id), [config.target, config.region])

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
  const feedbackAt = useRef(0)
  const [selection, setSelection] = useState<Selection | null>(null)
  const watch = useStopwatch()
  const qWatch = useStopwatch()
  const { read: readTotal } = watch
  const { read: readQuestion, reset: resetQuestion } = qWatch

  const resume = useCallback(() => {
    watch.resume()
    qWatch.resume()
  }, [watch, qWatch])
  const pause = useCallback(() => {
    watch.pause()
    qWatch.pause()
  }, [watch, qWatch])

  const q = questions[index]
  const score = answers.filter((a) => a.ok).length
  const locate = config.mode === 'locate'

  useEffect(() => {
    resume()
    // démarrage unique du chrono
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishOrNext = useCallback(
    (list: Answer[]) => {
      const next = index + 1
      if (next >= questions.length) {
        onFinish({ rawMs: readTotal(), answers: list })
        return
      }
      const lastWrong = !list[list.length - 1].ok
      setIndex(next)
      setPhase('asking')
      setReveal({})
      setSelection(null)
      setText('')
      if (locate) {
        if (lastWrong) setView({ key: `reset${next}` })
      } else {
        setView(makeNameView(world, questions[next], next))
      }
      resetQuestion()
      resume()
      inputRef.current?.focus()
    },
    [index, questions, locate, world, onFinish, resume, resetQuestion, readTotal],
  )

  const record = useCallback(
    (ok: boolean, extra: Reveal = {}, given?: string) => {
      pause()
      if (ok) markFound(config.target, config.mode, q.id)
      const list = [...answers, { question: q, ok, given }]
      setAnswers(list)
      setReveal(extra)
      setPhase(ok ? 'correct' : 'wrong')
      feedbackAt.current = performance.now()
      if (!ok && locate && isFlowKind(q.kind)) {
        setView({
          key: `reveal${index}`,
          flows: [q.id],
          points: extra.tapped && (extra.km ?? 0) < FRAME_TAP_KM ? [[extra.tapped.lon, extra.tapped.lat]] : undefined,
          ...flowView(q.kind),
        })
      } else if (!ok && locate) {
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
    [answers, config.mode, config.target, index, locate, pause, q, world],
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

  const timeUp = () => {
    if (phase === 'asking') record(false, { timeout: true })
  }

  const skip = () => {
    if (phase === 'asking') record(false, {}, undefined)
  }

  const confirmSelection = () => {
    if (!selection || phase !== 'asking') return
    if (q.kind === 'country') {
      if (selection.id) record(selection.id === q.id, { tappedId: selection.id })
    } else if (selection.lon !== undefined && selection.lat !== undefined && isFlowKind(q.kind)) {
      const tapped = { lon: selection.lon, lat: selection.lat }
      const verdict = judgeFlowTap([tapped.lon, tapped.lat], q.id, poolIds)
      if (verdict) record(verdict.correct, { tapped, km: verdict.km, at: verdict.at, otherId: verdict.otherId })
    } else if (selection.lon !== undefined && selection.lat !== undefined) {
      const at: [number, number] = [selection.lon, selection.lat]
      const km = Math.min(...q.points.map((p) => distanceKm(at, [p.lon, p.lat])))
      const nearest = q.points.reduce((a, b) =>
        distanceKm(at, [a.lon, a.lat]) <= distanceKm(at, [b.lon, b.lat]) ? a : b,
      )
      record(km <= CAPITAL_TOLERANCE_KM, { tapped: { lon: at[0], lat: at[1] }, km }, nearest.label)
    }
  }

  const handleTap = (tap: TapInfo) => {
    if (phase !== 'asking') {
      if (performance.now() - feedbackAt.current > FEEDBACK_GUARD_MS) finishOrNext(answers)
      return
    }
    if (!locate) return
    if (q.kind === 'country') {
      if (!tap.id) return
      if (selection?.id === tap.id) confirmSelection()
      else setSelection({ id: tap.id })
    } else {
      if (tap.lon === null || tap.lat === null) return
      if (selection?.lon !== undefined && tap.nearSelected) confirmSelection()
      else setSelection({ lon: tap.lon, lat: tap.lat })
    }
  }

  const highlights = useMemo(() => {
    const h: Record<string, HighlightKind> = {}
    if (!q || isFlowKind(q.kind)) return h
    if (!locate) {
      h[q.id] = phase === 'asking' ? 'target' : phase === 'correct' ? 'correct' : 'wrong'
    } else if (phase === 'asking') {
      if (selection?.id) h[selection.id] = 'selected'
    } else if (phase === 'correct') {
      if (q.kind === 'country') h[q.id] = 'correct'
    } else if (phase === 'wrong') {
      if (q.kind === 'country') {
        if (reveal.tappedId && reveal.tappedId !== q.id) h[reveal.tappedId] = 'wrong'
        h[q.id] = 'correct'
      }
    }
    return h
  }, [q, locate, phase, reveal.tappedId, selection])

  const markers = useMemo<MapMarker[]>(() => {
    if (!q) return []
    const list: MapMarker[] = []
    const showStar = q.kind === 'capital' && (!locate || phase !== 'asking')
    if (showStar) q.points.forEach((p) => list.push({ lon: p.lon, lat: p.lat, kind: 'star' }))
    if (locate && q.kind !== 'country') {
      if (reveal.tapped) list.push({ ...reveal.tapped, kind: 'guess' })
      else if (phase === 'asking' && selection?.lon !== undefined && selection.lat !== undefined)
        list.push({ lon: selection.lon, lat: selection.lat, kind: 'guess' })
    }
    return list
  }, [q, locate, phase, reveal.tapped, selection])

  const flows = useMemo<MapFlow[]>(() => {
    if (!q || !isFlowKind(q.kind)) return []
    if (!locate) return [{ id: q.id, state: phase === 'asking' ? 'target' : phase === 'correct' ? 'correct' : 'wrong' }]
    if (phase === 'asking') return []
    const list: MapFlow[] = [{ id: q.id, state: 'correct' }]
    if (reveal.otherId) list.push({ id: reveal.otherId, state: 'wrong' })
    return list
  }, [q, locate, phase, reveal.otherId])

  const labels = useMemo<MapLabel[]>(() => {
    if (!q || phase === 'asking') return []
    const list: MapLabel[] = []
    if (isFlowKind(q.kind)) {
      const anchor = flowGeometry(q.id)?.anchor
      if (anchor) list.push({ lon: anchor[0], lat: anchor[1], text: q.label, dy: -12 })
      const other = reveal.otherId ? flowGeometry(reveal.otherId)?.anchor : null
      if (other && reveal.otherId)
        list.push({ lon: other[0], lat: other[1], text: FLOW_BY_ID.get(reveal.otherId)?.name ?? '', dy: -12 })
      if (locate && reveal.km !== undefined && reveal.tapped) {
        list.push({
          lon: reveal.tapped.lon,
          lat: reveal.tapped.lat,
          text: `${Math.round(reveal.km).toLocaleString('fr-FR')} km`,
          dy: 24,
        })
      }
    } else if (q.kind === 'capital') {
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
    if (!q || !locate || q.kind === 'country' || phase === 'asking' || !reveal.tapped) return null
    if (isFlowKind(q.kind)) {
      return reveal.at
        ? [
            [reveal.tapped.lon, reveal.tapped.lat],
            [reveal.at[0], reveal.at[1]],
          ]
        : null
    }
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
  }, [q, locate, phase, reveal.tapped, reveal.at])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pause()
      else if (phase === 'asking' && !confirmQuit) resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause, resume, phase, confirmQuit])

  const closeQuit = () => {
    setConfirmQuit(false)
    if (phase === 'asking') resume()
  }

  if (!q) return null

  const noun = TARGETS[q.kind].noun
  const feminine = q.kind === 'capital'
  const tempWord = q.temp ? (q.temp === 'warm' ? ' chaud' : ' froid') : ''
  const prompt = locate
    ? `Situe ${feminine ? 'cette' : 'ce'} ${noun}${tempWord}`
    : `${feminine ? 'Quelle est cette' : 'Quel est ce'} ${noun}${tempWord} ?`

  const lastGiven = answers[answers.length - 1]?.given
  const wrongDetail =
    phase === 'wrong'
      ? reveal.timeout
        ? 'Temps écoulé'
        : locate
          ? q.kind === 'country'
            ? reveal.tappedId
              ? `Tu as touché : ${world.byId.get(reveal.tappedId)?.name ?? '—'}`
              : null
            : reveal.otherId
              ? `Tu as désigné : ${FLOW_BY_ID.get(reveal.otherId)?.name ?? '—'}`
              : reveal.km !== undefined
                ? `Tu étais à ${Math.round(reveal.km).toLocaleString('fr-FR')} km`
                : null
          : lastGiven
            ? `Tu as écrit : ${lastGiven}`
            : 'Passé'
      : null

  const correctDetail =
    phase === 'correct' && locate && q.kind === 'capital' && reveal.km !== undefined
      ? `À ${Math.round(reveal.km).toLocaleString('fr-FR')} km`
      : null
  const nextLabel = index + 1 >= questions.length ? 'Résultat' : 'Suivant'

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
      <Hud
        index={index}
        total={questions.length}
        score={score}
        onQuit={() => {
          pause()
          setConfirmQuit(true)
        }}
        timer={{
          read: readQuestion,
          limitMs: TIME_LIMIT_MS[config.mode],
          active: phase === 'asking',
          onExpire: timeUp,
        }}
      />

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <WorldMap
          world={world}
          region={config.region}
          highlights={highlights}
          markers={markers}
          labels={labels}
          flows={flows}
          line={line}
          view={view}
          onTap={handleTap}
          tapRings={locate && !isFlowKind(q.kind)}
          interactive
        />

        {!(locate && phase !== 'asking') && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: 12,
              right: 12,
              textAlign: 'center',
              pointerEvents: 'none',
              ...halo,
            }}
          >
            <Typography variant="overline" sx={{ color: tokens.brickDark, display: 'block', fontSize: '0.64rem' }}>
              {phase !== 'asking' ? 'Touche la carte pour continuer' : prompt}
            </Typography>
            {locate && (
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: 'clamp(1rem, 4.6vw, 1.3rem)',
                  lineHeight: 1.15,
                  color: tokens.ink,
                  opacity: 0.88,
                }}
              >
                {q.label}
              </Typography>
            )}
          </Box>
        )}

        {locate && phase === 'asking' && selection && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 'max(18px, env(safe-area-inset-bottom))',
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Button
              variant="contained"
              onClick={confirmSelection}
              sx={{
                pointerEvents: 'auto',
                minWidth: 200,
                minHeight: 52,
                filter: 'drop-shadow(0 8px 10px rgba(58,46,32,.35))',
              }}
            >
              Sélectionner
            </Button>
          </Box>
        )}

        {!locate && phase !== 'asking' && q.note && (
          <Box
            sx={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: 'max(10px, env(safe-area-inset-bottom))',
              py: 0.75,
              px: 1.5,
              background: 'rgba(249,243,227,.82)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: `1px solid ${tokens.hairSoft}`,
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          >
            <FlowNote question={q} />
          </Box>
        )}

        {locate && phase !== 'asking' && (
          <Box
            sx={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: 'max(10px, env(safe-area-inset-bottom))',
              py: 0.75,
              pl: 1.5,
              pr: 0.75,
              background: 'rgba(249,243,227,.78)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: `1px solid ${tokens.hairSoft}`,
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  lineHeight: 1.2,
                  color: phase === 'correct' ? tokens.sage : tokens.wrong,
                }}
              >
                {phase === 'correct' ? 'Exact' : 'C’était'} : {q.label}
              </Typography>
              {(wrongDetail || correctDetail) && (
                <Typography sx={{ color: tokens.inkSoft, fontSize: '0.74rem', lineHeight: 1.25 }}>
                  {wrongDetail ?? correctDetail}
                </Typography>
              )}
              {q.note && <FlowNote question={q} />}
            </Box>
            <Button variant="contained" autoFocus onClick={() => finishOrNext(answers)} sx={{ minHeight: 40, px: 2 }}>
              {nextLabel}
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
            ...doubleRule('top'),
            px: 1.5,
            pt: 2,
            pb: 'max(10px, env(safe-area-inset-bottom))',
          }}
        >
          <Box sx={{ maxWidth: 640, mx: 'auto' }}>
            {phase !== 'asking' && (
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '1.05rem',
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
                placeholder={`Nom ${feminine ? 'de la' : 'du'} ${noun}…`}
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
                  height: 50,
                  px: 1.5,
                  fontWeight: 600,
                  fontSize: '1.15rem',
                  color: phase === 'correct' ? tokens.sage : phase === 'wrong' ? tokens.wrong : tokens.ink,
                  background: tokens.paperLight,
                  border: `1px solid ${tokens.hair}`,
                  borderRadius: '2px',
                  outline: 'none',
                  '&:focus': { borderColor: tokens.brick, boxShadow: '0 0 0 3px rgba(168,69,43,.15)' },
                  '&::placeholder': { color: 'rgba(110,92,69,.6)', fontWeight: 500, fontStyle: 'italic' },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                onMouseDown={(e) => e.preventDefault()}
                sx={{ minWidth: 104, height: 50 }}
              >
                {phase === 'asking' ? 'Valider' : nextLabel}
              </Button>
            </Box>
            {phase === 'asking' && (
              <Button
                onMouseDown={(e) => e.preventDefault()}
                onClick={skip}
                sx={{
                  mt: 0.5,
                  minHeight: 36,
                  color: tokens.inkSoft,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  fontSize: '0.95rem',
                  fontWeight: 400,
                  letterSpacing: 0,
                }}
              >
                Je passe
              </Button>
            )}
          </Box>
        </Box>
      )}

      <Dialog open={confirmQuit} onClose={closeQuit}>
        <DialogTitle sx={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: '1.5rem' }}>
          Abandonner la série ?
        </DialogTitle>
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
