import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { loadWorld } from './data/world'
import type { WorldData } from './data/world'
import { PENALTY_MS, loadConfig, saveIfRecord, storeConfig } from './game/records'
import type { GameConfig } from './game/records'
import Home from './screens/Home'
import Play from './screens/Play'
import type { GameResult } from './screens/Play'
import Result from './screens/Result'
import type { FinishedGame } from './screens/Result'
import { fontDisplay, tokens } from './theme'
import { useAppHeight } from './ui/useAppHeight'

type Screen = { name: 'home' } | { name: 'play'; run: number } | { name: 'result'; game: FinishedGame }

function Splash({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <Box
      sx={{
        height: 'var(--app-h, 100dvh)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        textAlign: 'center',
        px: 3,
      }}
    >
      <Typography variant="h3" sx={{ fontFamily: fontDisplay }}>
        Le Petit Atlas
      </Typography>
      {error ? (
        <>
          <Typography sx={{ color: tokens.wrong }}>{error}</Typography>
          <Button variant="contained" onClick={onRetry}>
            Réessayer
          </Button>
        </>
      ) : (
        <>
          <CircularProgress size={28} sx={{ color: tokens.ink }} />
          <Typography sx={{ fontStyle: 'italic', color: tokens.inkSoft }}>Dépliage de la carte…</Typography>
        </>
      )}
    </Box>
  )
}

export default function App() {
  useAppHeight()
  const [world, setWorld] = useState<WorldData | null>(null)
  const [error, setError] = useState<string>()
  const [config, setConfig] = useState<GameConfig>(loadConfig)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  const load = useCallback(() => {
    loadWorld()
      .then(setWorld)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Chargement de la carte impossible.'))
  }, [])

  useEffect(load, [load])

  const retry = () => {
    setError(undefined)
    load()
  }

  const updateConfig = (c: GameConfig) => {
    setConfig(c)
    storeConfig(c)
  }

  const finish = (result: GameResult) => {
    const errors = result.answers.filter((a) => !a.ok).length
    const finalMs = Math.round(result.rawMs + errors * PENALTY_MS)
    const { isRecord, previous } = saveIfRecord(config, { ms: finalMs, errors, at: Date.now() })
    setScreen({ name: 'result', game: { config, ...result, finalMs, errors, isRecord, previous } })
  }

  if (!world) return <Splash error={error} onRetry={retry} />

  if (screen.name === 'play') {
    return (
      <Play
        key={screen.run}
        world={world}
        config={config}
        onExit={() => setScreen({ name: 'home' })}
        onFinish={finish}
      />
    )
  }

  if (screen.name === 'result') {
    return (
      <Result
        game={screen.game}
        onMenu={() => setScreen({ name: 'home' })}
        onReplay={() => setScreen({ name: 'play', run: Date.now() })}
      />
    )
  }

  return (
    <Home
      world={world}
      config={config}
      onChange={updateConfig}
      onPlay={() => setScreen({ name: 'play', run: Date.now() })}
    />
  )
}
