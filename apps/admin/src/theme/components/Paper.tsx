import { type Theme } from '@mui/material';
import { type Components } from '@mui/material/styles';

declare module '@mui/material' {
  interface PaperPropsVariantOverrides {
    default: true;
  }

  interface PaperOwnProps {
    background?: 1 | 2 | 3 | 4 | 5;
  }
}

declare module '@mui/material/styles' {
  interface TypeBackground {
    elevation5: string;
  }
  interface PaletteBackgroundChannel {
    elevation5Channel?: string;
  }
}

const backgroundVariants = [
  {
    props: { background: 1 as const },
    style: ({ theme }: { theme: Omit<Theme, 'components'> }) => ({
      backgroundColor: theme.vars.palette.background.elevation1,
    }),
  },
  {
    props: { background: 2 as const },
    style: ({ theme }: { theme: Omit<Theme, 'components'> }) => ({
      backgroundColor: theme.vars.palette.background.elevation2,
    }),
  },
  {
    props: { background: 3 as const },
    style: ({ theme }: { theme: Omit<Theme, 'components'> }) => ({
      backgroundColor: theme.vars.palette.background.elevation3,
    }),
  },
  {
    props: { background: 4 as const },
    style: ({ theme }: { theme: Omit<Theme, 'components'> }) => ({
      backgroundColor: theme.vars.palette.background.elevation4,
    }),
  },
  {
    props: { background: 5 as const },
    style: ({ theme }: { theme: Omit<Theme, 'components'> }) => ({
      backgroundColor: theme.vars.palette.background.elevation5,
    }),
  },
];

const Paper: Components<Omit<Theme, 'components'>>['MuiPaper'] = {
  variants: [
    {
      props: { variant: 'default' },
      style: ({ theme }) => ({
        border: 'none',
        outline: `1px solid ${theme.vars.palette.divider}`,
        borderRadius: 0,
      }),
    },
    ...backgroundVariants,
  ],
  defaultProps: {
    variant: 'default',
    elevation: 3,
  },
  styleOverrides: {
    elevation: ({ theme }) => ({
      backgroundColor: theme.vars.palette.background.menu,
      backgroundImage: 'none',
      // boxShadow: 'var(--Paper-shadow)',
      borderWidth: 0,
      borderStyle: 'solid',
      borderColor: theme.vars.palette.menuDivider,
      ...theme.applyStyles('dark', {
        borderWidth: 1,
      }),
    }),
    rounded: {
      borderRadius: 8,
    },
  },
};

export default Paper;
