import Box from '@mui/material/Box'
import { fontBody, tokens } from '../theme'

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
  hint?: string
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
            sx={{
              flex: 1,
              minHeight: 48,
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
              boxShadow: active ? `inset 0 -2px 0 ${tokens.brick}` : 'none',
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
                }}
              >
                {o.hint}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
