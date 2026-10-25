import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { formatTime } from '../game/records'
import type { GameConfig, RecordEntry } from '../game/records'
import { TARGETS } from '../game/targets'
import { REGIONS } from '../data/regions'
import { fontDisplay, tokens } from '../theme'
import Cartouche from '../ui/Cartouche'
import type { Answer } from './Play'

export interface FinishedGame {
  config: GameConfig
  answers: Answer[]
  score: number
  ms: number
  isRecord: boolean
  previous: RecordEntry | null
}

interface Props {
  game: FinishedGame
  onReplay: () => void
  onMenu: () => void
}

export default function Result({ game, onReplay, onMenu }: Props) {
  const { config, answers, score, ms, isRecord, previous } = game
  const missed = answers.filter((a) => !a.ok)
  const region = REGIONS.find((r) => r.id === config.region)?.label ?? ''
  const what = TARGETS[config.target].label
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
      <Cartouche sx={{ width: '100%', maxWidth: 520, alignSelf: 'flex-start', p: { xs: 3, sm: 4 }, my: 'auto' }}>
        <Typography variant="overline" sx={{ display: 'block', textAlign: 'center', color: tokens.brick }}>
          {what} · {how} · {region}
        </Typography>
        <Typography variant="h2" sx={{ textAlign: 'center', fontSize: '2.3rem', fontStyle: 'italic', mb: 2 }}>
          Série terminée
        </Typography>

        <Box
          sx={{
            textAlign: 'center',
            py: 1.5,
            borderTop: `1px solid ${tokens.hairSoft}`,
            borderBottom: `1px solid ${tokens.hairSoft}`,
          }}
        >
          <Typography
            sx={{
              fontFamily: fontDisplay,
              fontWeight: 500,
              fontSize: '4.6rem',
              fontFeatureSettings: '"lnum" 1',
              lineHeight: 1,
              color: isRecord && score > 0 ? tokens.brick : tokens.ink,
            }}
          >
            {score}
            <Box component="span" sx={{ fontSize: '2.2rem', color: tokens.inkSoft }}>
              {' '}
              / {answers.length}
            </Box>
          </Typography>
          <Typography sx={{ mt: 0.75, color: tokens.inkSoft, fontSize: '0.9rem' }}>en {formatTime(ms)}</Typography>
          {isRecord && score > 0 ? (
            <Chip
              label={previous ? 'Nouveau record !' : 'Premier record établi'}
              sx={{
                mt: 1.25,
                background: 'transparent',
                color: tokens.brick,
                border: `1px solid ${tokens.brick}`,
                fontSize: '0.74rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            />
          ) : (
            previous && (
              <Typography sx={{ mt: 1, color: tokens.inkSoft, fontSize: '0.85rem' }}>
                Record : {previous.score} / {previous.total} en {formatTime(previous.ms)}
              </Typography>
            )
          )}
        </Box>

        {missed.length > 0 && (
          <Box sx={{ my: 2 }}>
            <Typography variant="overline" sx={{ color: tokens.inkSoft, display: 'block', mb: 0.5 }}>
              À revoir
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {missed.map((a) => (
                <Chip
                  key={a.question.id}
                  variant="outlined"
                  label={
                    a.question.kind === 'capital' ? `${a.question.label} · ${a.question.context}` : a.question.label
                  }
                  sx={{ borderColor: tokens.hair, color: tokens.ink, background: 'rgba(162,59,59,.07)' }}
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
