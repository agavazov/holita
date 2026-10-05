// Aurora table styling used by the CRUD grid; built-in filter/column panels are not used.
import { type Theme, tablePaginationClasses } from '@mui/material';
import { type Components } from '@mui/material/styles';
import { gridClasses } from '@mui/x-data-grid/constants';
import { cssVarRgba } from '../utils.js';
import IconifyIcon from '../../layout/primitives/iconify-icon.js';
import DataGridPagination from '../../components/data-grid-pagination.js';

const DataGrid: NonNullable<Components<Omit<Theme, 'components'>>['MuiDataGrid']> = {
  defaultProps: {
    disableRowSelectionOnClick: true,
    disableColumnMenu: true,
    columnHeaderHeight: 48,
    getCellClassName: () => 'aurora-data-grid-cell',
    slots: {
      columnSortedDescendingIcon: () => <IconifyIcon icon="material-symbols:sort-rounded" />,
      columnSortedAscendingIcon: () => (
        <IconifyIcon icon="material-symbols:sort-rounded" sx={{ transform: 'rotateX(180deg)' }} />
      ),
      basePagination: DataGridPagination,
    },
  },
  styleOverrides: {
    root: ({ theme }) => ({
      border: 'none',
      overflow: 'unset',
      [`& .${gridClasses.filler}`]: {
        '--DataGrid-rowBorderColor': 'transparent',
      },
      '--DataGrid-rowBorderColor': theme.vars.palette.dividerLight,
    }),
    main: {
      overflow: 'unset',
    },
    columnHeaders: ({ theme }) => ({
      '--DataGrid-t-header-background-base': theme.vars.palette.background.elevation1,
      overflow: 'hidden',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    }),
    columnHeaderTitleContainer: {
      overflow: 'unset',
      [`& .${gridClasses.columnHeaderTitleContainerContent}`]: {
        overflow: 'unset',
      },
    },
    row: ({ theme }) => ({
      [`&.${gridClasses['row--firstVisible']}`]: { '--rowBorderColor': 'transparent' },
      '&:hover': {
        backgroundColor: 'transparent',
      },
      '&.Mui-selected': {
        backgroundColor: cssVarRgba(theme.vars.palette.primary.lightChannel, 0.08),
      },
      [`& .${gridClasses.cell}`]: {
        '&.aurora-data-grid-cell': {
          padding: `0 ${theme.spacing(3)}`,
          [`&.${gridClasses.cellCheckbox}`]: {
            padding: 0,
          },
        },
      },
    }),
    columnHeader: ({ theme }) => ({
      padding: `0 ${theme.spacing(3)}`,
      [`&.${gridClasses.columnHeaderCheckbox}`]: {
        padding: 0,
      },
      borderBottom: `0 !important`,
      '&:focus': {
        outline: 'none',
      },
      '&:focus-within': {
        outline: `2px solid ${theme.vars.palette.primary.main}`,
        outlineOffset: -2,
      },
    }),
    columnSeparator: {
      display: 'none',
    },
    cell: ({ theme }) => ({
      lineHeight: 'unset',
      display: 'flex',
      alignItems: 'center',
      color: theme.vars.palette.text.secondary,
      ...theme.typography.subtitle2,
      fontWeight: 400,
      '&:focus': {
        outline: 'none',
      },
      '&:focus-within': {
        outline: `2px solid ${theme.vars.palette.primary.main}`,
        outlineOffset: -2,
      },
    }),
    cellCheckbox: {
      width: 64,
    },
    cellEmpty: {
      padding: 0,
    },
    columnHeaderCheckbox: {
      width: '64px !important',
    },
    virtualScroller: {
      '@supports (-moz-appearance:none)': {
        scrollbarWidth: 'thin',
        overflowY: 'hidden',
      },
    },

    sortIcon: ({ theme }) => ({
      color: theme.vars.palette.text.primary,
    }),
    selectedRowCount: { display: 'none' },
    footerContainer: ({ theme }) => ({
      backgroundColor: theme.vars.palette.background.elevation1,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
      border: 'none',
      [`& .${tablePaginationClasses.root}`]: {
        flex: 1,
      },
    }),
    filler: {
      height: 0,
      border: 'none',
    },
  },
};

export default DataGrid;
