import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

export const theme = createTheme({
  palette: {
    primary: { main: tokens.color.brand, dark: tokens.color.brandStrong, light: tokens.color.brandSubtle },
    secondary: { main: tokens.color.accent },
    success: { main: tokens.color.success },
    warning: { main: tokens.color.warning },
    error: { main: tokens.color.danger },
    background: { default: tokens.color.surface, paper: tokens.color.surfaceRaised },
    text: { primary: tokens.color.text, secondary: tokens.color.textMuted },
    divider: tokens.color.border,
  },
  shape: { borderRadius: tokens.radius.md },
  spacing: tokens.spacingUnit,
  typography: {
    fontFamily: tokens.font.family,
    fontSize: tokens.font.sizeBase,
    h1: { fontSize: '1.6rem', fontWeight: 600 },
    h2: { fontSize: '1.3rem', fontWeight: 600 },
    h3: { fontSize: '1.1rem', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none' } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiPaper: { defaultProps: { variant: 'outlined' } },
  },
});
