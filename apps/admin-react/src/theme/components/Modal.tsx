import { type Components, type Theme } from '@mui/material';

const Modal: Components<Omit<Theme, 'components'>>['MuiModal'] = {
  defaultProps: {
    disableScrollLock: true,
  },
  styleOverrides: {},
};

export default Modal;
