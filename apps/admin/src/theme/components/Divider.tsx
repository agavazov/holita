import { type Theme } from '@mui/material';
import { type Components } from '@mui/material/styles';

const Divider: Components<Omit<Theme, 'components'>>['MuiDivider'] = {
  styleOverrides: {},
};

export default Divider;
