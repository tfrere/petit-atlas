import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { PENALTY_MS, formatTime } from '../game/records'
import type { GameConfig, RecordEntry } from '../game/records'
import { REGIONS } from '../data/regions'
import { fontDisplay, tokens } from '../theme'
import Cartouche from '../ui/Cartouche'
import type { Answer } from './Play'

export interface FinishedGame {
  config: GameConfig
  rawMs: number
  answers: Answer[]
  finalMs: number
  errors: number
  isRecord: boolean
  previous: RecordEntry | null
}

interface Props {
  game: FinishedGame
  onReplay: () => void
  onMenu: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
      <Typography sx={{ color: tokens.inkSoft }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  )
}

export default function Result({ game, onReplay, onMenu }: Props) {
  const { config, answers, errors, rawMs, finalMs, isRecord, previous } = game
  const good = answers.length - errors
  const missed = answers.filter((a) => !a.ok)
  const region = REGIONS.find((r) => r.id === config.region)?.label ?? ''
  const what = config.target === 'country' ? 'Pays' : 'Capitales'
  const how = config.mode === 'name' ? 'je nomme' : 'je situe'

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
        <Typography variant="overline" sx={{ display: 'block', textAlign: 'center', color: tokens.brick }}>
          {what} · {how} · {region}
        </Typography>
        <Typography variant="h2" sx={{ textAlign: 'center', fontSize: '2rem', mb: 1.5 }}>
          Série terminée
        </Typography>

        <Box
          sx={{
            textAlign: 'center',
            py: 1.5,
            borderTop: `1px dashed ${tokens.inkSoft}`,
            borderBottom: `1px dashed ${tokens.inkSoft}`,
          }}
        >
          <Typography
            sx={{
              fontFamily: fontDisplay,
              fontWeight: 700,
              fontSize: '3.6rem',
              lineHeight: 1,
              color: isRecord ? tokens.brick : tokens.ink,
            }}
          >
            {formatTime(finalMs)}
          </Typography>
          {isRecord ? (
            <Chip
              label={previous ? 'Nouveau record !' : 'Premier record établi'}
              sx={{ mt: 1, background: tokens.brick, color: '#fbf5e6', fontSize: '0.95rem' }}
            />
          ) : (
            previous && (
              <Typography sx={{ mt: 0.75, color: tokens.inkSoft }}>
                Record à battre : <strong>{formatTime(previous.ms)}</strong>
              </Typography>
            )
          )}
        </Box>

        <Box sx={{ my: 1.5 }}>
          <Row label="Bonnes réponses" value={`${good} / ${answers.length}`} />
          <Row label="Temps réel" value={formatTime(rawMs)} />
          <Row
            label={`Pénalités (${errors} × ${PENALTY_MS / 1000} s)`}
            value={`+ ${formatTime(errors * PENALTY_MS)}`}
          />
        </Box>

        {missed.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" sx={{ color: tokens.inkSoft, display: 'block', mb: 0.5 }}>
              À revoir
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {missed.map((a) => (
                <Chip
                  key={a.question.id}
                  variant="outlined"
                  label={
                    a.question.kind === 'capital' ? `${a.question.label} · ${a.question.countryName}` : a.question.label
                  }
                  sx={{ borderColor: tokens.ink, color: tokens.ink, background: 'rgba(155,45,48,.08)' }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: '1fr 1fr' }}>
          <Button variant="outlined" onClick={onMenu}>
            Menu
          </Button>
          <Button variant="contained" onClick={onReplay}>
            Rejouer
          </Button>
        </Box>
      </Cartouche>
    </Box>
  )
}
