import { createTheme } from '@mui/material/styles'

export const tokens = {
  paper: '#f2e8d0',
  paperDeep: '#e8dbbb',
  ink: '#2e2418',
  inkSoft: '#5d4c37',
  ocean: '#cfdcd3',
  brick: '#b4472a',
  brickDark: '#8a2f1d',
  sage: '#5f8450',
  wrong: '#9b2d30',
  gold: '#b88a2e',
  land: ['#ead7a8', '#cfd6a9', '#e6bfa1', '#d9cdae', '#bccbc2'],
}

export const fontDisplay = '"Cormorant Garamond", "Iowan Old Style", Georgia, serif'
export const fontBody = '"Crimson Pro", "Iowan Old Style", Georgia, serif'

const grain =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35 0 0 0 0 .27 0 0 0 0 .16 0 0 0 .1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.brick, dark: tokens.brickDark, contrastText: '#fbf5e6' },
    secondary: { main: tokens.sage },
    error: { main: tokens.wrong },
    success: { main: tokens.sage },
    background: { default: tokens.paper, paper: '#f7efdb' },
    text: { primary: tokens.ink, secondary: tokens.inkSoft },
  },
  shape: { borderRadius: 3 },
  typography: {
    fontFamily: fontBody,
    fontSize: 17,
    h1: { fontFamily: fontDisplay, fontWeight: 700, letterSpacing: '0.01em' },
    h2: { fontFamily: fontDisplay, fontWeight: 700 },
    h3: { fontFamily: fontDisplay, fontWeight: 700 },
    h4: { fontFamily: fontDisplay, fontWeight: 700 },
    h5: { fontFamily: fontDisplay, fontWeight: 700 },
    h6: { fontFamily: fontDisplay, fontWeight: 700 },
    button: { fontFamily: fontBody, fontWeight: 600, textTransform: 'none', letterSpacing: '0.02em' },
    overline: { fontFamily: fontBody, fontWeight: 600, letterSpacing: '0.18em', lineHeight: 1.4 },
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
      defaultProps: { disableElevation: true },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            border: `1.5px solid ${tokens.ink}`,
            boxShadow: `3px 3px 0 ${tokens.ink}`,
            '&:hover': { boxShadow: `3px 3px 0 ${tokens.ink}` },
            '&:active': { transform: 'translate(2px, 2px)', boxShadow: `1px 1px 0 ${tokens.ink}` },
          },
        },
      ],
      styleOverrides: {
        root: { borderRadius: 3, minHeight: 48, fontSize: '1.05rem' },
        outlined: {
          borderColor: tokens.ink,
          color: tokens.ink,
          borderWidth: 1.5,
          '&:hover': { borderWidth: 1.5, borderColor: tokens.ink, backgroundColor: 'rgba(46,36,24,.06)' },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: fontBody,
          fontSize: '1.02rem',
          fontWeight: 600,
          color: tokens.ink,
          borderColor: tokens.ink,
          borderWidth: 1.5,
          minHeight: 48,
          lineHeight: 1.15,
          '&.Mui-selected': {
            color: '#fbf5e6',
            backgroundColor: tokens.ink,
            '&:hover': { backgroundColor: tokens.ink },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: fontBody, fontWeight: 600, borderRadius: 3 },
      },
    },
  },
})
