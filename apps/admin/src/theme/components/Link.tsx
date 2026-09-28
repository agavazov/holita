import type { Components, Theme } from '@mui/material/styles';

const Link: Components<Omit<Theme, 'components'>>['MuiLink'] = {
  defaultProps: { underline: 'hover' },
  styleOverrides: {
    underlineHover: {
      position: 'relative',
      backgroundImage: 'linear-gradient(currentcolor, currentcolor)',
      backgroundSize: '0% 1px',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'left bottom',
      transition: 'background-size 0.25s ease-in',
      '&:hover': { textDecoration: 'none', backgroundSize: '100% 1px' },
    },
  },
};
export default Link;
