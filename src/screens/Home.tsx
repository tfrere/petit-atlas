import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { REGIONS } from '../data/regions'
import type { RegionId } from '../data/types'
import { COUNTRIES } from '../data/world'
import type { WorldData } from '../data/world'
import { formatTime, getRecord } from '../game/records'
import type { GameConfig } from '../game/records'
import { poolFor } from '../game/targets'
import type { PlayMode, TargetKind } from '../game/targets'
import WorldMap from '../map/WorldMap'
import { fontBody, fontDisplay, tokens } from '../theme'
import Cartouche from '../ui/Cartouche'
import Segmented from '../ui/Segmented'

interface Props {
  world: WorldData
  config: GameConfig
  onChange: (c: GameConfig) => void
  onPlay: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
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

function Ornament() {
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, color: tokens.brick, mt: 1.25 }}
    >
      <Box sx={{ width: 56, height: '1px', background: tokens.hair }} />
      <Box component="svg" viewBox="-10 -10 20 20" sx={{ width: 13, height: 13 }} aria-hidden>
        <path d="M0,-9 L2,-2 L9,0 L2,2 L0,9 L-2,2 L-9,0 L-2,-2 Z" fill="currentColor" />
      </Box>
      <Box sx={{ width: 56, height: '1px', background: tokens.hair }} />
    </Box>
  )
}

const TARGET_OPTIONS = [
  { value: 'country' as const, label: 'Pays' },
  { value: 'capital' as const, label: 'Capitales' },
]
const MODE_OPTIONS = [
  { value: 'name' as const, label: 'Je nomme', hint: 'la carte, j’écris' },
  { value: 'locate' as const, label: 'Je situe', hint: 'le nom, je touche' },
]
const COUNTS = [10, 20, 0]

export default function Home({ world, config, onChange, onPlay }: Props) {
  const total = useMemo(() => poolFor(config.target, config.region, COUNTRIES).length, [config.target, config.region])
  const record = getRecord(config)
  const effectiveCount = config.count === 0 || config.count >= total ? total : config.count

  const set = (patch: Partial<GameConfig>) => onChange({ ...config, ...patch })

  return (
    <Box
      sx={{
        height: 'var(--app-h, 100dvh)',
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
        px: { xs: 1.5, sm: 3 },
        py: { xs: 'max(12px, env(safe-area-inset-top))', sm: 4 },
        pb: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      <Cartouche sx={{ width: '100%', maxWidth: 500, alignSelf: 'flex-start', p: { xs: 3, sm: 4 }, my: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          <Typography variant="overline" sx={{ color: tokens.brick }}>
            Géographie au chrono
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.9rem', sm: '3.4rem' },
              lineHeight: 1,
              mt: 0.5,
              fontFamily: fontDisplay,
              fontStyle: 'italic',
            }}
          >
            Le Petit Atlas
          </Typography>
          <Ornament />
        </Box>

        <Box
          sx={{
            height: { xs: 120, sm: 150 },
            mb: 3,
            border: `1px solid ${tokens.hair}`,
            outline: `1px solid ${tokens.hairSoft}`,
            outlineOffset: 3,
            overflow: 'hidden',
            background: tokens.paper,
          }}
        >
          <WorldMap world={world} region={config.region} interactive={false} view={{ key: config.region }} />
        </Box>

        <Section title="Je cherche">
          <Segmented
            label="Cible"
            value={config.target}
            options={TARGET_OPTIONS}
            onChange={(v: TargetKind) => set({ target: v })}
          />
        </Section>

        <Section title="Je joue">
          <Segmented
            label="Mode"
            value={config.mode}
            options={MODE_OPTIONS}
            onChange={(v: PlayMode) => set({ mode: v })}
          />
        </Section>

        <Section title="Où">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} role="radiogroup" aria-label="Région">
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
                    minHeight: 40,
                    px: 1.5,
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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.75 }}>
          <Typography variant="overline" sx={{ color: tokens.inkSoft }}>
            Record
          </Typography>
          <Typography sx={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: '1.4rem', lineHeight: 1 }}>
            {record ? (
              <>
                {formatTime(record.ms)}
                <Typography
                  component="span"
                  sx={{ fontSize: '0.95rem', color: tokens.inkSoft, ml: 1, fontFamily: fontBody, fontWeight: 400 }}
                >
                  {record.errors} erreur{record.errors > 1 ? 's' : ''}
                </Typography>
              </>
            ) : (
              <Typography
                component="span"
                sx={{ fontSize: '1.05rem', fontWeight: 400, fontStyle: 'italic', color: tokens.inkSoft }}
              >
                à établir
              </Typography>
            )}
          </Typography>
        </Box>

        <Button fullWidth variant="contained" color="primary" size="large" onClick={onPlay} sx={{ minHeight: 54 }}>
          Jouer · {effectiveCount} questions
        </Button>
        <Typography
          sx={{ textAlign: 'center', mt: 1.5, fontSize: '0.88rem', color: tokens.inkSoft, fontStyle: 'italic' }}
        >
          Chaque erreur ajoute 5 secondes au chrono.
        </Typography>
      </Cartouche>
    </Box>
  )
}
