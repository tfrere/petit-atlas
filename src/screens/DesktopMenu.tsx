import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { regionById } from '../data/regions'
import type { RegionId } from '../data/types'
import { completion } from '../game/progress'
import type { GameConfig } from '../game/records'
import { TARGETS, validRegion } from '../game/targets'
import type { PlayMode, TargetKind } from '../game/targets'
import { fontBody, fontDisplay, tokens } from '../theme'

interface Props {
  config: GameConfig
  total: number
  questions: number
  onChange: (c: GameConfig) => void
  onPlay: () => void
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden {...stroke}>
    {children}
  </svg>
)

const ICONS: Record<TargetKind, ReactNode> = {
  country: (
    <Icon>
      <path d="M6 21V4" />
      <path d="M6 5c4-2 6 2 12 0v9c-6 2-8-2-12 0" />
    </Icon>
  ),
  capital: (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="m12 7.5 1.4 3 3.2.4-2.4 2.2.7 3.2-2.9-1.7-2.9 1.7.7-3.2-2.4-2.2 3.2-.4z" />
    </Icon>
  ),
  current: (
    <Icon>
      <path d="M3 9c2.5-2.5 4.5 2.5 7 0s4.5 2.5 7 0" />
      <path d="M3 15c2.5-2.5 4.5 2.5 7 0s4.5 2.5 7 0" />
      <path d="m18 12 3 3-3 3" />
    </Icon>
  ),
  wind: (
    <Icon>
      <path d="M3 9h10a3 3 0 1 0-3-3" />
      <path d="M3 13h15a3 3 0 1 1-3 3" />
      <path d="M3 17h6" />
    </Icon>
  ),
}

const MODE_ICONS: Record<PlayMode, ReactNode> = {
  name: (
    <Icon>
      <path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z" />
      <path d="m14.5 6.5 3 3" />
    </Icon>
  ),
  locate: (
    <Icon>
      <path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </Icon>
  ),
}

const TARGET_OPTIONS: { value: TargetKind; label: string }[] = [
  { value: 'country', label: 'Pays' },
  { value: 'capital', label: 'Capitales' },
  { value: 'current', label: 'Courants' },
  { value: 'wind', label: 'Vents' },
]
const MODE_OPTIONS: { value: PlayMode; label: string; hint: string }[] = [
  { value: 'name', label: 'Je nomme', hint: 'La carte est montrée, j’écris le nom.' },
  { value: 'locate', label: 'Je situe', hint: 'Le nom est donné, je touche la carte.' },
]
const COUNTS = [10, 20, 0]

const TIGHT = '@media (max-height: 800px)'

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2.75, [TIGHT]: { mb: 1.75 } }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 1.1, [TIGHT]: { mb: 0.8 } }}>
        <Typography
          component="span"
          sx={{ fontFamily: fontDisplay, fontStyle: 'italic', fontSize: '1.25rem', lineHeight: 1, color: tokens.brick }}
        >
          {n}
        </Typography>
        <Typography variant="overline" sx={{ color: tokens.inkSoft, whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1, height: '1px', background: tokens.hairSoft, alignSelf: 'center' }} />
      </Box>
      {children}
    </Box>
  )
}

function ProgressBar({ percent, active }: { percent: number; active: boolean }) {
  return (
    <Box aria-hidden sx={{ height: 3, background: tokens.hairSoft, borderRadius: '2px', overflow: 'hidden' }}>
      <Box
        sx={{
          height: '100%',
          width: `${percent}%`,
          background: active ? tokens.brick : tokens.inkSoft,
          transition: 'width .3s',
        }}
      />
    </Box>
  )
}

const choice = (active: boolean) => ({
  position: 'relative' as const,
  textAlign: 'left' as const,
  fontFamily: fontBody,
  color: active ? tokens.brickDark : tokens.ink,
  background: active ? 'rgba(168,69,43,.09)' : 'rgba(255,252,243,.5)',
  border: `1px solid ${active ? tokens.brick : tokens.hair}`,
  boxShadow: active ? `inset 0 0 0 1px ${tokens.brick}` : 'none',
  borderRadius: '2px',
  cursor: 'pointer',
  transition: 'background .15s, border-color .15s, transform .15s',
  '&:hover': { background: active ? 'rgba(168,69,43,.13)' : 'rgba(58,46,32,.05)', transform: 'translateY(-1px)' },
  '&:focus-visible': { outline: `2px solid ${tokens.brick}`, outlineOffset: 2 },
})

/** Panneau de réglages du bureau : quatre étapes numérotées, puis le départ. */
export default function DesktopMenu({ config, total, questions, onChange, onPlay }: Props) {
  const set = (patch: Partial<GameConfig>) => onChange({ ...config, ...patch })
  const regions = TARGETS[config.target].regions.map(regionById)
  const region = regionById(config.region)
  const target = TARGET_OPTIONS.find((t) => t.value === config.target)!
  const mode = MODE_OPTIONS.find((m) => m.value === config.mode)!

  return (
    <Box
      component="aside"
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(to right, rgba(249,243,227,.96), rgba(249,243,227,.9))',
        borderLeft: `1px solid ${tokens.hair}`,
        boxShadow: '-24px 0 48px -32px rgba(58,46,32,.5)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 4,
          width: '1px',
          background: tokens.hairSoft,
          pointerEvents: 'none',
        },
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            my: 'auto',
            width: '100%',
            maxWidth: 520,
            mx: 'auto',
            px: 4,
            py: 3.5,
            [TIGHT]: { py: 2.25 },
          }}
        >
          <Typography
            component="h2"
            sx={{
              fontFamily: fontDisplay,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: '2rem',
              lineHeight: 1,
              mb: 0.75,
              [TIGHT]: { fontSize: '1.7rem' },
            }}
          >
            Nouvelle partie
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: tokens.inkSoft, mb: 3, [TIGHT]: { mb: 2 } }}>
            Quatre réglages, puis on part.
          </Typography>

          <Step n="I" title="Je cherche">
            <Box
              role="radiogroup"
              aria-label="Cible"
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}
            >
              {TARGET_OPTIONS.map((o) => {
                const active = o.value === config.target
                const c = completion(o.value, config.mode)
                return (
                  <Box
                    key={o.value}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={`${c.found} / ${c.total}`}
                    onClick={() => set({ target: o.value, region: validRegion(o.value, config.region) })}
                    sx={{ ...choice(active), px: 1.5, pt: 1.25, pb: 1.25, [TIGHT]: { pt: 0.9, pb: 0.9 } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, [TIGHT]: { mb: 0.7 } }}>
                      <Box sx={{ display: 'flex', color: active ? tokens.brick : tokens.inkSoft }}>
                        {ICONS[o.value]}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            fontFamily: fontDisplay,
                            fontStyle: 'italic',
                            fontSize: '1.4rem',
                            lineHeight: 1,
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          {o.label}
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          fontSize: '0.74rem',
                          fontVariantNumeric: 'tabular-nums',
                          color: active ? tokens.brickDark : tokens.inkSoft,
                        }}
                      >
                        {c.percent} %
                      </Box>
                    </Box>
                    <ProgressBar percent={c.percent} active={active} />
                  </Box>
                )
              })}
            </Box>
          </Step>

          <Step n="II" title="Je joue">
            <Box
              role="radiogroup"
              aria-label="Mode"
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}
            >
              {MODE_OPTIONS.map((o) => {
                const active = o.value === config.mode
                const c = completion(config.target, o.value)
                return (
                  <Box
                    key={o.value}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={`${c.found} / ${c.total}`}
                    onClick={() => set({ mode: o.value })}
                    sx={{ ...choice(active), px: 1.5, py: 1.25, [TIGHT]: { py: 0.9 } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Box sx={{ display: 'flex', color: active ? tokens.brick : tokens.inkSoft }}>
                        {MODE_ICONS[o.value]}
                      </Box>
                      <Box
                        sx={{
                          flex: 1,
                          fontFamily: fontDisplay,
                          fontStyle: 'italic',
                          fontSize: '1.4rem',
                          lineHeight: 1,
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {o.label}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        fontSize: '0.72rem',
                        lineHeight: 1.35,
                        color: tokens.inkSoft,
                        minHeight: '2.7em',
                        [TIGHT]: { minHeight: 0 },
                      }}
                    >
                      {o.hint}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Step>

          <Step n="III" title="Où">
            <Box
              role="radiogroup"
              aria-label="Région"
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${regions.length === 4 ? 4 : 3}, minmax(0, 1fr))`,
                gap: 0.75,
              }}
            >
              {regions.map((r) => {
                const active = r.id === config.region
                return (
                  <Box
                    key={r.id}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set({ region: r.id as RegionId })}
                    sx={{
                      ...choice(active),
                      px: 0.5,
                      minHeight: 40,
                      textAlign: 'center',
                      fontSize: '0.86rem',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {r.label}
                  </Box>
                )
              })}
            </Box>
          </Step>

          <Step n="IV" title="Série">
            <Box role="radiogroup" aria-label="Longueur de la série" sx={{ display: 'flex', gap: 0.75 }}>
              {COUNTS.map((n) => {
                const active = n === config.count
                return (
                  <Box
                    key={n}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set({ count: n })}
                    sx={{
                      ...choice(active),
                      flex: 1,
                      minHeight: 38,
                      textAlign: 'center',
                      fontSize: '0.92rem',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {n === 0 ? `Tous · ${total}` : n}
                  </Box>
                )
              })}
            </Box>
          </Step>
        </Box>
      </Box>

      <Box sx={{ px: 4, pt: 2, pb: 3, borderTop: `1px solid ${tokens.hairSoft}`, [TIGHT]: { pt: 1.5, pb: 2 } }}>
        <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
          <Typography
            sx={{
              mb: 1.25,
              textAlign: 'center',
              fontSize: '0.74rem',
              color: tokens.inkSoft,
              letterSpacing: '0.02em',
            }}
          >
            {target.label} · {mode.label.toLowerCase()} · {region.label}
          </Typography>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            onClick={onPlay}
            sx={{ minHeight: 56, [TIGHT]: { minHeight: 48 } }}
          >
            Jouer · {questions} questions&nbsp;&nbsp;→
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
