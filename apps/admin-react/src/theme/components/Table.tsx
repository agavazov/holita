// Aurora table presentation for expandable Event history.
import { type Theme, tableCellClasses } from '@mui/material';
import type { Components } from '@mui/material/styles';

export const TableContainer: Components<Omit<Theme, 'components'>>['MuiTableContainer'] = {
  styleOverrides: {
    root: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
  },
};

export const TableRow: Components<Omit<Theme, 'components'>>['MuiTableRow'] = {
  styleOverrides: {
    root: () => ({
      '& td, & th': {
        '&:first-of-type': { paddingLeft: 24 },
        '&:last-of-type': { paddingRight: 24 },
      },
    }),
  },
};

export const TableHead: Components<Omit<Theme, 'components'>>['MuiTableHead'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      '& th': {
        backgroundColor: theme.vars.palette.background.elevation1,
        borderBottom: 0,
        paddingTop: 12,
        paddingBottom: 12,
      },
    }),
  },
};

export const TableCell: Components<Omit<Theme, 'components'>>['MuiTableCell'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      borderBottom: `1px solid ${theme.vars.palette.dividerLight}`,
      [`&.${tableCellClasses.body}`]: {
        color: theme.vars.palette.text.secondary,
        ...theme.typography.subtitle2,
        fontWeight: 400,
      },
    }),
    stickyHeader: {
      backgroundColor: 'transparent',
    },
  },
};
