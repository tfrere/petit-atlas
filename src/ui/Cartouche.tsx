import Box from '@mui/material/Box'
import type { BoxProps } from '@mui/material/Box'
import { tokens } from '../theme'

/** Cadre à double filet, façon cartouche de titre d'atlas. */
export default function Cartouche({ sx, children, ...rest }: BoxProps) {
  return (
    <Box
      {...rest}
      sx={{
        position: 'relative',
        background: 'rgba(250,243,225,.85)',
        border: `1.5px solid ${tokens.ink}`,
        boxShadow: `inset 0 0 0 4px #f7efdb, inset 0 0 0 5.5px ${tokens.ink}`,
        borderRadius: '3px',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}
