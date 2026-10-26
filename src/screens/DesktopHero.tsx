import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { keyframes } from '@emotion/react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { RegionId } from '../data/types'
import type { WorldData } from '../data/world'
import { entriesOf } from '../game/targets'
import type { TargetKind } from '../game/targets'
import { fontDisplay, tokens } from '../theme'
import MiniGlobe from '../ui/MiniGlobe'

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
`
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(.96); }
  to { opacity: 1; transform: none; }
`
const rise = (delayMs: number) => ({
  animation: `${riseIn} 900ms cubic-bezier(.2,.7,.2,1) ${delayMs}ms backwards`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

const FRAME = 16
const SUMMARY_W = 300

const STATS: { kind: TargetKind; label: string }[] = [
  { kind: 'country', label: 'pays' },
  { kind: 'capital', label: 'capitales' },
  { kind: 'current', label: 'courants' },
  { kind: 'wind', label: 'vents' },
]

function useBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

/** Couronne graduée autour du globe, comme le limbe d'un instrument de navigation. */
function Bezel({ size }: { size: number }) {
  const ticks = useMemo(() => Array.from({ length: 72 }, (_, i) => i * 5), [])
  return (
    <Box
      component="svg"
      viewBox="-100 -100 200 200"
      aria-hidden
      sx={{ position: 'absolute', inset: 0, width: size, height: size, color: tokens.ink, pointerEvents: 'none' }}
    >
      <circle r="97" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth=".35" />
      <circle r="91.5" fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth=".3" strokeDasharray="1 2.4" />
      {ticks.map((a) => {
        const major = a % 30 === 0
        return (
          <line
            key={a}
            y1={-97}
            y2={major ? -92.5 : a % 10 === 0 ? -94.2 : -95.4}
            transform={`rotate(${a})`}
            stroke="currentColor"
            strokeOpacity={major ? 0.7 : 0.4}
            strokeWidth={major ? 0.5 : 0.3}
          />
        )
      })}
      <path d="M0,-103.5 L1.6,-98.5 L-1.6,-98.5 Z" fill="currentColor" fillOpacity=".7" />
    </Box>
  )
}

const needleSway = keyframes`
  0%, 100% { transform: rotate(-7deg); }
  50% { transform: rotate(9deg); }
`

function CompassStar() {
  return (
    <Box
      component="svg"
      viewBox="-50 -50 100 100"
      aria-hidden
      sx={{ width: 92, height: 92, color: tokens.ink, opacity: 0.62, flex: 'none' }}
    >
      <circle r="45" fill="none" stroke="currentColor" strokeWidth=".5" />
      <circle r="38" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle r="33" fill="none" stroke="currentColor" strokeWidth=".4" strokeDasharray="1 2" />
      {Array.from({ length: 16 }, (_, i) => (
        <line
          key={i}
          y1={-38}
          y2={i % 2 ? -41 : -44}
          transform={`rotate(${i * 22.5})`}
          stroke="currentColor"
          strokeWidth=".6"
        />
      ))}
      <path d="M0,0 L22,-22 M0,0 L-22,-22 M0,0 L22,22 M0,0 L-22,22" stroke="currentColor" strokeWidth=".6" />
      <Box
        component="g"
        sx={{
          transformOrigin: '0 0',
          animation: `${needleSway} 9s ease-in-out infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <path
          d="M0,-36 L6.5,-6.5 L0,0 Z M0,36 L-6.5,6.5 L0,0 Z M36,0 L6.5,6.5 L0,0 Z M-36,0 L-6.5,-6.5 L0,0 Z"
          fill="currentColor"
        />
        <path
          d="M0,-36 L-6.5,-6.5 L0,0 Z M0,36 L6.5,6.5 L0,0 Z M36,0 L6.5,-6.5 L0,0 Z M-36,0 L-6.5,6.5 L0,0 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth=".8"
        />
      </Box>
      <text y="-47.5" textAnchor="middle" fontSize="8" fontStyle="italic" fill="currentColor" fontFamily={fontDisplay}>
        N
      </text>
    </Box>
  )
}

/** Échelle graphique à damier, sous la boussole. */
function ScaleBar() {
  const seg = 28
  return (
    <Box sx={{ color: tokens.ink }}>
      <Box sx={{ display: 'flex', border: '1px solid currentColor', width: seg * 4, height: 7 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={{ flex: 1, background: i % 2 ? 'transparent' : 'currentColor' }} />
        ))}
      </Box>
      <Box
        sx={{
          mt: 0.5,
          display: 'flex',
          justifyContent: 'space-between',
          width: seg * 4,
          fontSize: '0.62rem',
          color: tokens.inkSoft,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>0</span>
        <span>1 000</span>
        <span>2 000 km</span>
      </Box>
    </Box>
  )
}

/** Cadre de carte : double filet, graduations de lisière sur les quatre côtés. */
function Neatline({ inset }: { inset: number }) {
  const tick = (axis: 'x' | 'y', step: number, major: number, len: number) => {
    const dir = axis === 'x' ? 'to right' : 'to bottom'
    const line = (c: string, every: number) =>
      `repeating-linear-gradient(${dir}, ${c} 0 1px, transparent 1px ${every}px)`
    return {
      minor: line(tokens.hairSoft, step),
      major: line(tokens.hair, major),
      len,
    }
  }
  const h = tick('x', 12, 60, 4)
  const v = tick('y', 12, 60, 4)
  const strip = (sx: object, minor: string, major: string, horizontal: boolean) => (
    <>
      <Box
        sx={{ position: 'absolute', ...(horizontal ? { height: 4 } : { width: 4 }), backgroundImage: minor, ...sx }}
      />
      <Box
        sx={{ position: 'absolute', ...(horizontal ? { height: 8 } : { width: 8 }), backgroundImage: major, ...sx }}
      />
    </>
  )
  const pad = 14
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset, pointerEvents: 'none', border: `1px solid ${tokens.hair}` }}>
      <Box sx={{ position: 'absolute', inset: 4, border: `1px solid ${tokens.hairSoft}` }} />
      {strip({ top: 5, left: pad, right: pad }, h.minor, h.major, true)}
      {strip({ bottom: 5, left: pad, right: pad }, h.minor, h.major, true)}
      {strip({ left: 5, top: pad, bottom: pad }, v.minor, v.major, false)}
      {strip({ right: 5, top: pad, bottom: pad }, v.minor, v.major, false)}
    </Box>
  )
}

interface Props {
  world: WorldData
  region: RegionId
}

/** Hero des grands écrans : titre en haut à gauche, globe monumental qui déborde du bas à droite. */
export default function DesktopHero({ world, region }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { w, h } = useBox(ref)
  const stats = useMemo(() => STATS.map((s) => ({ ...s, n: entriesOf(s.kind).length })), [])

  const sideBySide = w >= 780
  const textW = Math.min(480, Math.max(320, w * 0.4))
  const padLeft = Math.min(88, Math.max(36, w * 0.052))
  const ringFree = sideBySide ? Math.min(h * 0.94, (w - textW) * 1.1, 880) : Math.min(w * 1.02, h * 0.62, 760)
  const ringBesideIndex = (w - padLeft - SUMMARY_W - 28) / 0.92
  const showSummary = sideBySide && h >= 640 && Math.min(ringFree, ringBesideIndex) >= Math.min(h * 0.72, 560)
  const ring = showSummary ? Math.min(ringFree, ringBesideIndex) : ringFree
  const globe = Math.max(0, ring / 1.17)
  const cx = sideBySide ? w - ring / 2 + ring * 0.08 : w / 2
  const cy = h - ring / 2 + ring * 0.1
  return (
    <Box ref={ref} sx={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 60% at 62% 62%, rgba(255,252,243,.9), rgba(243,234,212,0) 70%), linear-gradient(rgba(58,46,32,.045) 1px, transparent 1px) 0 0 / 100% 56px',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          left: 'clamp(36px, 5.2vw, 88px)',
          top: 'clamp(28px, 6.5vh, 64px)',
          zIndex: 1,
          maxWidth: sideBySide ? textW : '88%',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ...rise(0) }}>
          <Box sx={{ width: 36, height: '1px', background: tokens.brick }} />
          <Typography variant="overline" sx={{ color: tokens.brick }}>
            Atlas de poche
          </Typography>
        </Box>
        <Typography
          variant="h1"
          sx={{
            mt: 1.25,
            fontSize: 'clamp(3.4rem, min(7.4vw, 12.5vh), 7.4rem)',
            lineHeight: 0.92,
            letterSpacing: '-0.025em',
            fontStyle: 'italic',
            fontWeight: 500,
            ...rise(80),
          }}
        >
          Le Petit
          <Box component="span" sx={{ display: 'block', pl: '0.9em', fontFamily: fontDisplay }}>
            Atlas
          </Box>
        </Typography>
        <Typography
          sx={{
            mt: 2.25,
            maxWidth: '34ch',
            fontSize: '0.92rem',
            lineHeight: 1.55,
            color: tokens.inkSoft,
            ...rise(180),
          }}
        >
          Devine les pays, les capitales, les courants marins et les vents sur une carte d’atlas.
        </Typography>
        {showSummary && (
          <Box sx={{ mt: 3.5, width: SUMMARY_W, ...rise(260) }}>
            <Typography variant="overline" sx={{ color: tokens.brick, display: 'block', mb: 0.5 }}>
              Au sommaire
            </Typography>
            {stats.map((s, i) => (
              <Box
                key={s.kind}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 1,
                  py: 0.55,
                  borderTop: `1px solid ${i === 0 ? tokens.hair : tokens.hairSoft}`,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: fontDisplay,
                    fontStyle: 'italic',
                    fontSize: '1.25rem',
                    lineHeight: 1.1,
                    textTransform: 'capitalize',
                  }}
                >
                  {s.label}
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    borderBottom: `1px dotted ${tokens.inkSoft}`,
                    opacity: 0.6,
                    transform: 'translateY(-3px)',
                  }}
                />
                <Typography
                  sx={{
                    fontFamily: fontDisplay,
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.n}
                </Typography>
              </Box>
            ))}
            <Box sx={{ borderTop: `1px solid ${tokens.hair}` }} />
          </Box>
        )}
      </Box>

      <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(${FRAME}px)` }}>
        {globe > 120 && (
          <Box
            sx={{
              position: 'absolute',
              left: cx - ring / 2,
              top: cy - ring / 2,
              width: ring,
              height: ring,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `${fadeIn} 1100ms cubic-bezier(.2,.7,.2,1) 200ms backwards`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Bezel size={ring} />
            <MiniGlobe world={world} region={region} size={Math.round(globe)} />
          </Box>
        )}
      </Box>

      <Neatline inset={FRAME} />

      {sideBySide && h >= 560 && (
        <Box
          sx={{
            position: 'absolute',
            left: 'clamp(36px, 5.2vw, 88px)',
            bottom: 'clamp(30px, 5vh, 52px)',
            display: 'flex',
            alignItems: 'center',
            gap: 2.5,
            ...rise(340),
          }}
        >
          <CompassStar />
          <ScaleBar />
        </Box>
      )}
    </Box>
  )
}
