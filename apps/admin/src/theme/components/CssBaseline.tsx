import type { Components, Theme } from '@mui/material/styles';
import { darkShadows } from '../shadows.js';
import simplebar from '../styles/simplebar.js';
import popper from '../styles/popper.js';

const CssBaseline: Components<Omit<Theme, 'components'>>['MuiCssBaseline'] = {
  styleOverrides: (theme) => ({
    '*': { scrollbarWidth: 'thin' },
    html: { fontSize: theme.typography.fontSize },
    body: {
      scrollbarColor: `${theme.vars.palette.background.elevation4} transparent`,
      fontVariantLigatures: 'none',
      '[id]': { scrollMarginTop: 82 },
    },
    ...simplebar(theme),
    ...popper(theme),
    '[data-holita-color-scheme="dark"][data-holita-preset="ember"] .MuiPaper-root[class*="MuiPaper-elevation"], [data-holita-color-scheme="dark"][data-holita-preset="midnight"] .MuiPaper-root[class*="MuiPaper-elevation"]':
      {
        boxShadow: `${darkShadows[1] ?? 'none'} !important`,
      },
  }),
};
export default CssBaseline;
