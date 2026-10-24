import Box from '@mui/material/Box'
import { fontBody, tokens } from '../theme'

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
  hint?: string
  /** Complétion 0–100 : affichée en pourcentage discret et en filet au pied du bouton */
  progress?: number
  progressTitle?: string
}

interface Props<T extends string | number> {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  label: string
}

/** Choix exclusif à filets fins : l'option active est teintée et soulignée, sans aplat lourd. */
export default function Segmented<T extends string | number>({ value, options, onChange, label }: Props<T>) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{ display: 'flex', border: `1px solid ${tokens.hair}`, borderRadius: '2px', overflow: 'hidden' }}
    >
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <Box
            key={String(o.value)}
            component="button"
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            title={o.progressTitle}
            sx={{
              position: 'relative',
              flex: 1,
              minHeight: 48,
              whiteSpace: 'nowrap',
              '@media (max-height: 700px) and (max-width: 899.95px)': { minHeight: 40, py: 0.25 },
              px: 1,
              py: 0.75,
              fontFamily: fontBody,
              fontSize: '1.02rem',
              fontWeight: active ? 600 : 400,
              lineHeight: 1.15,
              color: active ? tokens.brickDark : tokens.ink,
              background: active ? 'rgba(168,69,43,.09)' : 'transparent',
              border: 0,
              borderLeft: i === 0 ? 0 : `1px solid ${tokens.hairSoft}`,
              boxShadow: active && o.progress === undefined ? `inset 0 -2px 0 ${tokens.brick}` : 'none',
              cursor: 'pointer',
              transition: 'background .15s',
              '&:hover': { background: active ? 'rgba(168,69,43,.12)' : 'rgba(58,46,32,.04)' },
            }}
          >
            {o.label}
            {o.hint && (
              <Box
                component="span"
                sx={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: tokens.inkSoft,
                  '@media (max-height: 700px) and (max-width: 899.95px)': { display: 'none' },
                }}
              >
                {o.hint}
              </Box>
            )}
            {o.progress !== undefined && (
              <>
                <Box
                  component="span"
                  sx={{
                    display: 'block',
                    mt: 0.25,
                    fontSize: '0.78rem',
                    fontWeight: 400,
                    color: active ? tokens.brickDark : tokens.inkSoft,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {o.progress} %
                </Box>
                <Box
                  component="span"
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '2px',
                    background: tokens.hairSoft,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      height: '100%',
                      width: `${o.progress}%`,
                      background: active ? tokens.brick : tokens.inkSoft,
                      transition: 'width .3s',
                    }}
                  />
                </Box>
              </>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
