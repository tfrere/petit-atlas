import { useMemo } from 'react'
import { keyframes } from '@emotion/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { REGIONS } from '../data/regions'
import type { RegionId } from '../data/types'
import { COUNTRIES } from '../data/world'
import type { WorldData } from '../data/world'
import { completion } from '../game/progress'
import type { GameConfig } from '../game/records'
import { poolFor } from '../game/targets'
import type { PlayMode, TargetKind } from '../game/targets'
import WorldMap from '../map/WorldMap'
import { fontBody, tokens } from '../theme'
import MiniGlobe from '../ui/MiniGlobe'
import Segmented from '../ui/Segmented'

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(16px) scale(0.985); }
  to { opacity: 1; transform: none; }
`

/** Entrée en cascade du hero ; désactivée si l'utilisateur réduit les animations. */
const rise = (delayMs: number, durationMs = 900) => ({
  animation: `${riseIn} ${durationMs}ms cubic-bezier(.2,.7,.2,1) ${delayMs}ms backwards`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
})

interface Props {
  world: WorldData
  config: GameConfig
  onChange: (c: GameConfig) => void
  onPlay: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: { xs: 2, md: 2.75 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
        <Typography variant="overline" sx={{ color: tokens.inkSoft, whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1, height: '1px', background: tokens.hairSoft }} />
      </Box>
      {children}
    </Box>
  )
}

const TARGET_OPTIONS: { value: TargetKind; label: string; hint?: string }[] = [
  { value: 'country', label: 'Pays' },
  { value: 'capital', label: 'Capitales' },
]
const MODE_OPTIONS: { value: PlayMode; label: string; hint?: string }[] = [
  { value: 'name', label: 'Je nomme', hint: 'la carte, j’écris' },
  { value: 'locate', label: 'Je situe', hint: 'le nom, je touche' },
]
const COUNTS = [10, 20, 0]

export default function Home({ world, config, onChange, onPlay }: Props) {
  const total = useMemo(() => poolFor(config.target, config.region, COUNTRIES).length, [config.target, config.region])
  const effectiveCount = config.count === 0 || config.count >= total ? total : config.count

  const withProgress = <T extends TargetKind | PlayMode>(
    options: { value: T; label: string; hint?: string }[],
    pair: (v: T) => [TargetKind, PlayMode],
  ) =>
    options.map((o) => {
      const c = completion(...pair(o.value))
      return { ...o, progress: c.percent, progressTitle: `${c.found} / ${c.total}` }
    })

  const compact = useMediaQuery('(max-width:599.95px)')

  const set = (patch: Partial<GameConfig>) => onChange({ ...config, ...patch })

  return (
    <Box
      sx={{
        height: 'var(--app-h, 100dvh)',
        overflowY: { xs: 'auto', md: 'hidden' },
        display: { xs: 'flex', md: 'grid' },
        flexDirection: { xs: 'column' },
        gridTemplateColumns: { md: 'minmax(0, 1fr) 500px' },
      }}
    >
      {compact ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2.25,
            px: 2.5,
            pt: 'max(18px, env(safe-area-inset-top))',
            pb: 2,
          }}
        >
          <Box sx={{ ...rise(0, 1000), display: 'flex' }}>
            <MiniGlobe world={world} region={config.region} size={116} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: tokens.brick, display: 'block', ...rise(60) }}>
              Pays & capitales
            </Typography>
            <Typography
              variant="h1"
              sx={{
                mt: 0.25,
                fontSize: '2.55rem',
                lineHeight: 0.98,
                letterSpacing: '-0.02em',
                fontStyle: 'italic',
                fontWeight: 500,
                ...rise(120),
              }}
            >
              Le Petit Atlas
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: '0.74rem', lineHeight: 1.35, color: tokens.inkSoft, ...rise(200) }}>
              Géographie sur une carte d’atlas.
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            height: { md: '100%' },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: { md: 'center' },
            textAlign: 'center',
            px: { xs: 2, md: 6 },
            pt: { xs: 'max(22px, env(safe-area-inset-top))', md: 0 },
            pb: { xs: 1.5, md: 0 },
            background: {
              md: 'radial-gradient(ellipse 75% 55% at 50% 52%, rgba(255,252,243,.85), rgba(243,234,212,0) 72%)',
            },
          }}
        >
          <Typography variant="overline" sx={{ color: tokens.brick, ...rise(0) }}>
            Géographie · pays & capitales
          </Typography>
          <Typography
            variant="h1"
            sx={{
              mt: 1,
              fontSize: { xs: '3.1rem', sm: '4.2rem', md: 'clamp(4rem, 8.4vw, 7rem)' },
              lineHeight: 1,
              letterSpacing: '-0.025em',
              fontStyle: 'italic',
              fontWeight: 500,
              ...rise(80),
            }}
          >
            Le Petit Atlas
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: '36ch', fontSize: '0.86rem', color: tokens.inkSoft, ...rise(160) }}>
            Devine les pays et les capitales sur une carte d’atlas.
          </Typography>
          <Box
            sx={{
              mt: { xs: 3, md: 5.5 },
              width: {
                xs: '100%',
                md: 'min(100%, 900px, calc((var(--app-h, 100dvh) - 360px) * 2.06))',
              },
              aspectRatio: '2.06 / 1',
              filter: 'drop-shadow(0 30px 28px rgba(58,46,32,.2)) drop-shadow(0 4px 5px rgba(58,46,32,.14))',
              ...rise(240, 1100),
            }}
          >
            <WorldMap world={world} region={config.region} interactive={false} vignette={false} still sheen />
          </Box>
        </Box>
      )}

      <Box
        sx={{
          gridColumn: { md: 2 },
          gridRow: { md: 1 },
          overflowY: { md: 'auto' },
          height: { md: '100%' },
          flex: { xs: '1 0 auto' },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 520,
            mx: 'auto',
            px: { xs: 2.5, md: 4 },
            pt: { xs: 0.5, md: 3 },
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: { md: 'center' },
          }}
        >
          <Section title="Je cherche">
            <Segmented
              label="Cible"
              value={config.target}
              options={withProgress(TARGET_OPTIONS, (t) => [t, config.mode])}
              onChange={(v: TargetKind) => set({ target: v })}
            />
          </Section>

          <Section title="Je joue">
            <Segmented
              label="Mode"
              value={config.mode}
              options={withProgress(MODE_OPTIONS, (m) => [config.target, m])}
              onChange={(v: PlayMode) => set({ mode: v })}
            />
          </Section>

          <Section title="Où">
            <Box
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75 }}
              role="radiogroup"
              aria-label="Région"
            >
              {REGIONS.map((r) => {
                const selected = r.id === config.region
                return (
                  <Box
                    key={r.id}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set({ region: r.id as RegionId })}
                    sx={{
                      minHeight: 44,
                      px: 1,
                      fontFamily: fontBody,
                      fontSize: '1rem',
                      fontWeight: selected ? 600 : 400,
                      color: selected ? tokens.brickDark : tokens.ink,
                      background: selected ? 'rgba(168,69,43,.09)' : 'transparent',
                      border: `1px solid ${selected ? tokens.brick : tokens.hair}`,
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  >
                    {r.label}
                  </Box>
                )
              })}
            </Box>
          </Section>

          <Section title="Série">
            <Segmented
              label="Longueur de la série"
              value={config.count}
              options={COUNTS.map((n) => ({ value: n, label: n === 0 ? `Tous · ${total}` : String(n) }))}
              onChange={(v: number) => set({ count: v })}
            />
          </Section>
        </Box>

        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            pt: 2.5,
            pb: 'max(14px, env(safe-area-inset-bottom))',
            px: { xs: 2.5, md: 4 },
            background: `linear-gradient(to top, ${tokens.paper} 62%, rgba(243,234,212,0))`,
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
            <Button fullWidth variant="contained" color="primary" size="large" onClick={onPlay} sx={{ minHeight: 54 }}>
              Jouer · {effectiveCount} questions
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
