import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import { keyframes } from '@emotion/react'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { loadFonts, wait } from './data/preload'
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

const spin = keyframes`
  to { transform: rotate(360deg); }
`
const pulse = keyframes`
  0%, 100% { opacity: 0.55; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1); }
`
const appear = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.99); filter: blur(3px); }
  to { opacity: 1; transform: none; filter: blur(0); }
`

function Spinner() {
  return (
    <Box
      sx={{ position: 'relative', width: 64, height: 64, color: tokens.ink }}
      role="progressbar"
      aria-label="Chargement"
    >
      <Box
        component="svg"
        viewBox="-32 -32 64 64"
        sx={{
          position: 'absolute',
          inset: 0,
          animation: `${spin} 1.6s linear infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <circle r="28" fill="none" stroke={tokens.hairSoft} strokeWidth="1" />
        <path
          d="M0,-28 A28,28 0 0 1 24.2,-14"
          fill="none"
          stroke={tokens.brick}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle r="22" fill="none" stroke={tokens.hairSoft} strokeWidth="0.6" strokeDasharray="1.5 3" />
      </Box>
      <Box
        component="svg"
        viewBox="-32 -32 64 64"
        sx={{
          position: 'absolute',
          inset: 0,
          animation: `${pulse} 2.4s ease-in-out infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <path d="M0,-15 L3,-3 L15,0 L3,3 L0,15 L-3,3 L-15,0 L-3,-3 Z" fill="currentColor" />
      </Box>
    </Box>
  )
}

function Splash({ error, onRetry, leaving }: { error?: string; onRetry?: () => void; leaving?: boolean }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        height: 'var(--app-h, 100dvh)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
        textAlign: 'center',
        px: 3,
        opacity: leaving ? 0 : 1,
        transition: 'opacity 450ms ease',
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {error ? (
        <>
          <Typography variant="h4" sx={{ fontFamily: fontDisplay, fontStyle: 'italic' }}>
            Le Petit Atlas
          </Typography>
          <Typography sx={{ color: tokens.wrong }}>{error}</Typography>
          <Button variant="contained" onClick={onRetry}>
            Réessayer
          </Button>
        </>
      ) : (
        <Spinner />
      )}
    </Box>
  )
}

const fade = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

export default function App() {
  useAppHeight()
  const [world, setWorld] = useState<WorldData | null>(null)
  const [error, setError] = useState<string>()
  const [splashGone, setSplashGone] = useState(false)
  const [config, setConfig] = useState<GameConfig>(loadConfig)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  const load = useCallback(() => {
    Promise.all([loadWorld(), loadFonts(), wait(450)])
      .then(([w]) => setWorld(w))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Chargement de la carte impossible.'))
  }, [])

  useEffect(load, [load])

  useEffect(() => {
    if (!world) return
    const id = window.setTimeout(() => setSplashGone(true), 500)
    return () => window.clearTimeout(id)
  }, [world])

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

  let content: React.ReactNode = null
  if (world) {
    if (screen.name === 'play') {
      content = (
        <Play
          key={screen.run}
          world={world}
          config={config}
          onExit={() => setScreen({ name: 'home' })}
          onFinish={finish}
        />
      )
    } else if (screen.name === 'result') {
      content = (
        <Result
          game={screen.game}
          onMenu={() => setScreen({ name: 'home' })}
          onReplay={() => setScreen({ name: 'play', run: Date.now() })}
        />
      )
    } else {
      content = (
        <Home
          world={world}
          config={config}
          onChange={updateConfig}
          onPlay={() => setScreen({ name: 'play', run: Date.now() })}
        />
      )
    }
  }

  return (
    <>
      {!splashGone && <Splash error={error} onRetry={retry} leaving={!!world} />}
      {world && (
        <Box
          sx={{
            position: 'relative',
            height: 'var(--app-h, 100dvh)',
            animation: `${appear} 800ms cubic-bezier(.2,.7,.2,1) backwards`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Box
            key={screen.name}
            sx={{
              height: '100%',
              animation: `${fade} 350ms ease both`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            {content}
          </Box>
        </Box>
      )}
    </>
  )
}
