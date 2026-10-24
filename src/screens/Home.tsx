import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { REGIONS } from '../data/regions'
import type { RegionId } from '../data/types'
import { COUNTRIES } from '../data/world'
import type { WorldData } from '../data/world'
import { completion } from '../game/progress'
import { formatTime, getRecord } from '../game/records'
import type { GameConfig } from '../game/records'
import { poolFor } from '../game/targets'
import type { PlayMode, TargetKind } from '../game/targets'
import WorldMap from '../map/WorldMap'
import { fontBody, fontDisplay, tokens } from '../theme'
import Segmented from '../ui/Segmented'

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

const PROGRESS_ROWS: { target: TargetKind; mode: PlayMode; label: string }[] = [
  { target: 'country', mode: 'name', label: 'Pays · nommer' },
  { target: 'country', mode: 'locate', label: 'Pays · situer' },
  { target: 'capital', mode: 'name', label: 'Capitales · nommer' },
  { target: 'capital', mode: 'locate', label: 'Capitales · situer' },
]

function Progress({ target, mode }: { target: TargetKind; mode: PlayMode }) {
  return (
    <Box
      aria-label="Complétion de chaque mode"
      sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2.5, rowGap: 1.25, mt: 0.5 }}
    >
      {PROGRESS_ROWS.map((row) => {
        const c = completion(row.target, row.mode)
        const active = row.target === target && row.mode === mode
        return (
          <Box key={`${row.target}.${row.mode}`} title={`${c.found} / ${c.total}`}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography
                sx={{ fontSize: '0.8rem', color: active ? tokens.ink : tokens.inkSoft, fontWeight: active ? 600 : 400 }}
              >
                {row.label}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: tokens.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                {c.percent} %
              </Typography>
            </Box>
            <Box sx={{ mt: 0.4, height: '2px', background: tokens.hairSoft }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${c.percent}%`,
                  background: active ? tokens.brick : tokens.inkSoft,
                  transition: 'width .3s',
                }}
              />
            </Box>
          </Box>
        )
      })}
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
        overflowY: { xs: 'auto', md: 'hidden' },
        display: { md: 'grid' },
        gridTemplateColumns: { md: 'minmax(0, 1fr) 500px' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: { xs: 'min(33dvh, 320px)', md: '100%' },
          minHeight: { xs: 230, md: 0 },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            WebkitMaskImage: {
              xs: 'linear-gradient(to bottom, #000 60%, transparent 100%)',
              md: 'linear-gradient(to right, #000 82%, transparent 100%)',
            },
            maskImage: {
              xs: 'linear-gradient(to bottom, #000 60%, transparent 100%)',
              md: 'linear-gradient(to right, #000 82%, transparent 100%)',
            },
          }}
        >
          <WorldMap
            world={world}
            region={config.region}
            interactive={false}
            cover
            vignette={false}
            view={{ key: config.region }}
          />
        </Box>

        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: { xs: 4, md: 0 },
            px: { xs: 3, md: 7 },
            pb: { md: 7 },
            textAlign: { xs: 'center', md: 'left' },
            pointerEvents: 'none',
          }}
        >
          <Typography variant="overline" sx={{ color: tokens.brick, display: 'block' }}>
            Géographie au chrono
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '3.2rem', md: '5.2rem' },
              lineHeight: 0.95,
              mt: 0.5,
              fontFamily: fontDisplay,
              fontStyle: 'italic',
              textShadow: `0 0 18px ${tokens.paper}, 0 0 8px ${tokens.paper}, 0 0 3px ${tokens.paper}`,
            }}
          >
            Le Petit Atlas
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          gridColumn: { md: 2 },
          gridRow: { md: 1 },
          overflowY: { md: 'auto' },
          height: { md: '100%' },
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
                      px: 1.75,
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
            <Typography sx={{ mt: 1, fontSize: '0.85rem', color: tokens.inkSoft, fontStyle: 'italic' }}>
              Chaque erreur ajoute 5 secondes au chrono.
            </Typography>
          </Section>

          <Section title="Complétion">
            <Progress target={config.target} mode={config.mode} />
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.25 }}>
              <Typography variant="overline" sx={{ color: tokens.inkSoft }}>
                Record
              </Typography>
              <Typography sx={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: '1.3rem', lineHeight: 1 }}>
                {record ? (
                  <>
                    {formatTime(record.ms)}
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.92rem', color: tokens.inkSoft, ml: 1, fontFamily: fontBody, fontWeight: 400 }}
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
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
