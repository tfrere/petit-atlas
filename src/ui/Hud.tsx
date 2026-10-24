import { useEffect, useRef, useState } from 'react'
import { keyframes } from '@emotion/react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { fontBody, tokens } from '../theme'

const LOW_TIME_MS = 5000
const RING = 22
const RING_STROKE = 3.5
const CIRC = 2 * Math.PI * (RING - RING_STROKE / 2 - 1)

const HUD_BG = 'linear-gradient(#41331f, #2b2218)'
const HUD_TEXT = '#f5ecd6'
const HUD_DIM = 'rgba(245,236,214,.55)'
const HUD_LINE = 'rgba(245,236,214,.2)'
const HUD_GOOD = '#b7d9a4'
const HUD_ALERT = '#ff9a73'

const pop = keyframes`
  0% { transform: scale(1); }
  35% { transform: scale(1.35); }
  100% { transform: scale(1); }
`
const floatUp = keyframes`
  0% { opacity: 0; transform: translateY(6px); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-16px); }
`
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.09); }
`

function Cell({
  label,
  children,
  align = 'left',
}: {
  label: string
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <Box sx={{ minWidth: 0, textAlign: align }}>
      <Typography
        sx={{
          fontSize: '0.54rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: HUD_DIM,
          lineHeight: 1,
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}

function Progress({ index, total }: { index: number; total: number }) {
  return (
    <Cell label="Question">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25, lineHeight: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.25rem', color: HUD_TEXT, lineHeight: 1 }}>
          {index + 1}
        </Typography>
        <Typography component="span" sx={{ fontSize: '0.74rem', color: HUD_DIM }}>
          /{total}
        </Typography>
      </Box>
      <Box sx={{ mt: 0.75, width: 76, height: 4, background: HUD_LINE, borderRadius: '1px', overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${(index / total) * 100}%`,
            background: HUD_TEXT,
            transition: 'width .5s cubic-bezier(.2,.7,.2,1)',
          }}
        />
      </Box>
    </Cell>
  )
}

function ScoreStat({ score }: { score: number }) {
  const prev = useRef(score)
  const [gain, setGain] = useState<{ id: number; delta: number } | null>(null)
  const [popId, setPopId] = useState(0)

  useEffect(() => {
    if (score > prev.current) {
      setGain({ id: Date.now(), delta: score - prev.current })
      setPopId((n) => n + 1)
    }
    prev.current = score
  }, [score])

  return (
    <Cell label="Score">
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <Typography
          key={popId}
          sx={{
            fontWeight: 700,
            fontSize: '1.25rem',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: score ? HUD_GOOD : HUD_TEXT,
            transformOrigin: 'left center',
            animation: popId ? `${pop} 420ms cubic-bezier(.2,.8,.3,1.2)` : 'none',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          {score}
        </Typography>
        {gain && (
          <Typography
            key={gain.id}
            aria-hidden
            sx={{
              position: 'absolute',
              left: '100%',
              top: -2,
              ml: 0.75,
              fontWeight: 700,
              fontSize: '0.8rem',
              color: HUD_GOOD,
              pointerEvents: 'none',
              animation: `${floatUp} 1000ms ease-out forwards`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0 },
            }}
          >
            +{gain.delta}
          </Typography>
        )}
      </Box>
    </Cell>
  )
}

/** Compte à rebours en anneau : s'arrête dès qu'une réponse est donnée et déclenche `onExpire` à zéro. */
function TimerRing({
  read,
  limitMs,
  active,
  onExpire,
}: {
  read: () => number
  limitMs: number
  active: boolean
  onExpire: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const fired = useRef(false)
  const expireRef = useRef(onExpire)

  useEffect(() => {
    expireRef.current = onExpire
  })
  useEffect(() => {
    const id = window.setInterval(() => {
      const ms = read()
      setElapsed(ms)
      if (active && ms >= limitMs && !fired.current) {
        fired.current = true
        expireRef.current()
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [read, limitMs, active])

  const remaining = Math.max(0, limitMs - elapsed)
  const low = remaining <= LOW_TIME_MS
  const color = low ? HUD_ALERT : HUD_TEXT
  const r = RING - RING_STROKE / 2 - 1

  return (
    <Box
      role="timer"
      aria-label={`${Math.ceil(remaining / 1000)} secondes restantes`}
      sx={{
        position: 'relative',
        width: RING * 2,
        height: RING * 2,
        flex: 'none',
        opacity: active ? 1 : 0.55,
        transition: 'opacity .25s',
        animation: low && active ? `${pulse} 1s ease-in-out infinite` : 'none',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <svg width={RING * 2} height={RING * 2} viewBox={`0 0 ${RING * 2} ${RING * 2}`} style={{ display: 'block' }}>
        <circle cx={RING} cy={RING} r={r} fill="none" stroke={HUD_LINE} strokeWidth={RING_STROKE} />
        <circle
          cx={RING}
          cy={RING}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="butt"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - remaining / limitMs)}
          transform={`rotate(-90 ${RING} ${RING})`}
          style={{ transition: 'stroke-dashoffset .1s linear, stroke .3s' }}
        />
      </svg>
      <Typography
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: '0.95rem',
          fontVariantNumeric: 'tabular-nums',
          color,
          transition: 'color .3s',
        }}
      >
        {Math.ceil(remaining / 1000)}
      </Typography>
    </Box>
  )
}

interface HudProps {
  index: number
  total: number
  score: number
  onQuit: () => void
  timer: { read: () => number; limitMs: number; active: boolean; onExpire: () => void }
}

/** Bandeau de jeu : abandon, progression, score et compte à rebours en anneau. */
export default function Hud({ index, total, score, onQuit, timer }: HudProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        px: 1.5,
        py: 1,
        color: HUD_TEXT,
        fontFamily: fontBody,
        background: HUD_BG,
        borderBottom: `2px solid ${tokens.brick}`,
        boxShadow: '0 4px 12px rgba(43,34,24,.28)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onQuit}
        aria-label="Abandonner"
        sx={{
          flex: 'none',
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          fontFamily: fontBody,
          fontSize: '1rem',
          color: HUD_TEXT,
          background: 'rgba(245,236,214,.08)',
          border: `1px solid ${HUD_LINE}`,
          borderRadius: '2px',
          cursor: 'pointer',
          '&:active': { background: 'rgba(245,236,214,.2)' },
        }}
      >
        ✕
      </Box>
      <Progress index={index} total={total} />
      <Box sx={{ flex: 1 }} />
      <ScoreStat score={score} />
      <Box sx={{ flex: 1 }} />
      <TimerRing key={index} {...timer} />
    </Box>
  )
}
