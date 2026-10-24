import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
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
import { fontDisplay, tokens } from '../theme'
import Cartouche from '../ui/Cartouche'

interface Props {
  world: WorldData
  config: GameConfig
  onChange: (c: GameConfig) => void
  onPlay: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.25 }}>
      <Typography variant="overline" sx={{ display: 'block', color: tokens.inkSoft, mb: 0.75 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

const groupSx = { display: 'flex', width: '100%', '& .MuiToggleButton-root': { flex: 1 } }

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
      <Cartouche sx={{ width: '100%', maxWidth: 520, alignSelf: 'flex-start', p: { xs: 2.25, sm: 3.25 }, my: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 1.5 }}>
          <Typography variant="overline" sx={{ color: tokens.brick }}>
            Géographie au chrono
          </Typography>
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: '2.6rem', sm: '3.1rem' }, lineHeight: 1, mt: 0.25, fontFamily: fontDisplay }}
          >
            Le Petit Atlas
          </Typography>
        </Box>

        <Box
          sx={{
            height: { xs: 118, sm: 150 },
            mb: 2.25,
            border: `1.5px solid ${tokens.ink}`,
            borderRadius: '2px',
            overflow: 'hidden',
            background: tokens.paper,
          }}
        >
          <WorldMap world={world} region={config.region} interactive={false} view={{ key: config.region }} />
        </Box>

        <Section title="Ce que tu cherches">
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={config.target}
            onChange={(_, v: TargetKind | null) => v && set({ target: v })}
            sx={groupSx}
          >
            <ToggleButton value="country">Pays</ToggleButton>
            <ToggleButton value="capital">Capitales</ToggleButton>
          </ToggleButtonGroup>
        </Section>

        <Section title="Comment tu joues">
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={config.mode}
            onChange={(_, v: PlayMode | null) => v && set({ mode: v })}
            sx={groupSx}
          >
            <ToggleButton value="name">
              <Box>
                Je nomme
                <Typography
                  component="span"
                  sx={{ display: 'block', fontSize: '0.8rem', opacity: 0.75, fontWeight: 400 }}
                >
                  la carte → j’écris
                </Typography>
              </Box>
            </ToggleButton>
            <ToggleButton value="locate">
              <Box>
                Je situe
                <Typography
                  component="span"
                  sx={{ display: 'block', fontSize: '0.8rem', opacity: 0.75, fontWeight: 400 }}
                >
                  le nom → je touche
                </Typography>
              </Box>
            </ToggleButton>
          </ToggleButtonGroup>
        </Section>

        <Section title="Où">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {REGIONS.map((r) => {
              const selected = r.id === config.region
              return (
                <Button
                  key={r.id}
                  size="small"
                  variant={selected ? 'contained' : 'outlined'}
                  color={selected ? 'inherit' : 'primary'}
                  onClick={() => set({ region: r.id as RegionId })}
                  sx={{
                    minHeight: 40,
                    px: 1.5,
                    fontSize: '1rem',
                    ...(selected && {
                      background: tokens.ink,
                      color: '#fbf5e6',
                      '&:hover': { background: tokens.ink },
                    }),
                  }}
                >
                  {r.label}
                </Button>
              )
            })}
          </Box>
        </Section>

        <Section title="Longueur de la série">
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={config.count}
            onChange={(_, v: number | null) => v !== null && set({ count: v })}
            sx={groupSx}
          >
            <ToggleButton value={10}>10</ToggleButton>
            <ToggleButton value={20}>20</ToggleButton>
            <ToggleButton value={0}>Tous ({total})</ToggleButton>
          </ToggleButtonGroup>
        </Section>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: `1px dashed ${tokens.inkSoft}`,
            pt: 1.25,
            mb: 1.5,
          }}
        >
          <Typography variant="overline" sx={{ color: tokens.inkSoft }}>
            Record
          </Typography>
          <Typography sx={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: '1.35rem' }}>
            {record ? (
              <>
                {formatTime(record.ms)}
                <Typography
                  component="span"
                  sx={{ fontSize: '0.95rem', color: tokens.inkSoft, ml: 1, fontFamily: 'inherit' }}
                >
                  {record.errors} erreur{record.errors > 1 ? 's' : ''}
                </Typography>
              </>
            ) : (
              <Typography
                component="span"
                sx={{ fontSize: '1rem', fontWeight: 400, fontStyle: 'italic', color: tokens.inkSoft }}
              >
                à établir
              </Typography>
            )}
          </Typography>
        </Box>

        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          onClick={onPlay}
          sx={{ minHeight: 56, fontSize: '1.25rem' }}
        >
          Jouer · {effectiveCount} questions
        </Button>
        <Typography
          sx={{ textAlign: 'center', mt: 1.25, fontSize: '0.85rem', color: tokens.inkSoft, fontStyle: 'italic' }}
        >
          Chaque erreur ajoute 5 s au chrono.
        </Typography>
      </Cartouche>
    </Box>
  )
}
