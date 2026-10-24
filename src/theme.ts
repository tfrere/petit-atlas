import { createTheme } from '@mui/material/styles'

export const tokens = {
  paper: '#f3ead4',
  paperLight: '#f9f3e3',
  ink: '#3a2e20',
  inkSoft: '#6e5c45',
  hair: 'rgba(58,46,32,.55)',
  hairSoft: 'rgba(58,46,32,.28)',
  ocean: '#d9e3dc',
  oceanLine: '#9fb6ab',
  brick: '#a8452b',
  brickDark: '#7d3220',
  sage: '#6b8c5a',
  wrong: '#a23b3b',
  target: '#cf7e50',
  land: ['#f0e4c0', '#e1e3c2', '#eed5b9', '#e6dcc2', '#d6dfd0'],
}

export const fontDisplay = '"Cormorant Garamond", "Iowan Old Style", Georgia, serif'
export const fontBody = '"Crimson Pro", "Iowan Old Style", Georgia, serif'

/** Deux filets fins, l'un contre l'autre, à poser en bas (ou en haut) d'un bandeau. */
export const doubleRule = (side: 'bottom' | 'top') => ({
  backgroundImage: `linear-gradient(${tokens.hair}, ${tokens.hair}), linear-gradient(${tokens.hairSoft}, ${tokens.hairSoft})`,
  backgroundSize: '100% 1px, 100% 1px',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: side === 'bottom' ? 'left bottom, left calc(100% - 3px)' : 'left top, left 3px',
})

const grain =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35 0 0 0 0 .27 0 0 0 0 .16 0 0 0 .07 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.brick, dark: tokens.brickDark, contrastText: '#fbf5e6' },
    secondary: { main: tokens.sage },
    error: { main: tokens.wrong },
    success: { main: tokens.sage },
    background: { default: tokens.paper, paper: tokens.paperLight },
    text: { primary: tokens.ink, secondary: tokens.inkSoft },
  },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: fontBody,
    fontSize: 16,
    h1: { fontFamily: fontDisplay, fontWeight: 500 },
    h2: { fontFamily: fontDisplay, fontWeight: 500 },
    h3: { fontFamily: fontDisplay, fontWeight: 500 },
    h4: { fontFamily: fontDisplay, fontWeight: 500 },
    h5: { fontFamily: fontDisplay, fontWeight: 500 },
    h6: { fontFamily: fontDisplay, fontWeight: 500 },
    button: { fontFamily: fontBody, fontWeight: 500, textTransform: 'none', letterSpacing: '0.03em' },
    overline: {
      fontFamily: fontBody,
      fontWeight: 500,
      fontSize: '0.72rem',
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      lineHeight: 1.5,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%' },
        body: {
          backgroundColor: tokens.paper,
          backgroundImage: grain,
          color: tokens.ink,
          overflow: 'hidden',
          overscrollBehavior: 'none',
          WebkitTapHighlightColor: 'transparent',
          WebkitFontSmoothing: 'antialiased',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: true },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            background: tokens.brick,
            color: '#fbf5e6',
            border: `1px solid ${tokens.brickDark}`,
            boxShadow: `inset 0 0 0 2px ${tokens.brick}, inset 0 0 0 3px rgba(251,245,230,.45)`,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: '0.88rem',
            fontWeight: 600,
            '&:hover': { background: tokens.brickDark },
            '&:active': { background: tokens.brickDark },
          },
        },
      ],
      styleOverrides: {
        root: { borderRadius: 2, minHeight: 46, fontSize: '1rem' },
        outlined: {
          borderColor: tokens.hair,
          color: tokens.ink,
          borderWidth: 1,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontSize: '0.85rem',
          fontWeight: 500,
          '&:hover': { borderWidth: 1, borderColor: tokens.ink, backgroundColor: 'rgba(58,46,32,.05)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: fontBody, fontWeight: 500, borderRadius: 2, height: 28 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: tokens.paperLight,
          border: `1px solid ${tokens.hair}`,
          boxShadow: `inset 0 0 0 4px ${tokens.paperLight}, inset 0 0 0 5px ${tokens.hairSoft}, 0 12px 40px rgba(58,46,32,.25)`,
          borderRadius: 2,
        },
      },
    },
  },
})
