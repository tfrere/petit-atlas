import Box from '@mui/material/Box'
import type { BoxProps } from '@mui/material/Box'
import { tokens } from '../theme'

/** Cadre à double filet fin, façon cartouche de titre d'atlas. */
export default function Cartouche({ sx, children, ...rest }: BoxProps) {
  return (
    <Box
      {...rest}
      sx={{
        position: 'relative',
        background: 'rgba(249,243,227,.78)',
        border: `1px solid ${tokens.hair}`,
        borderRadius: '2px',
        boxShadow: '0 1px 0 rgba(255,255,255,.5), 0 18px 40px -24px rgba(58,46,32,.45)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 5,
          border: `1px solid ${tokens.hairSoft}`,
          pointerEvents: 'none',
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}
