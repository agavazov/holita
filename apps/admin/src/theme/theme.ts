import { TableContainer, TableRow, TableHead, TableCell } from './components/Table.js';
import type {} from '@mui/x-data-grid/themeAugmentation';
import DataGrid from './components/DataGrid.js';
import Autocomplete from './components/Autocomplete.js';
import Checkbox from './components/Checkbox.js';
import { Tab, Tabs } from './components/Tab.js';
import { createTheme as muiCreateTheme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';
import './types.js';
import type { ThemePreset } from './config.js';
import AppBar from './components/AppBar.js';
import { Avatar } from './components/Avatar.js';
import Backdrop from './components/Backdrop.js';
import Breadcrumbs from './components/Breadcrumbs.js';
import Button, { ButtonBase } from './components/Button.js';
import Chip from './components/Chip.js';
import CssBaseline from './components/CssBaseline.js';
import Dialog from './components/Dialog.js';
import Divider from './components/Divider.js';
import Drawer from './components/Drawer.js';
import Link from './components/Link.js';
import List, { ListItemButton, ListItemIcon, ListItemText } from './components/List.js';
import { MenuItem } from './components/Menu.js';
import Modal from './components/Modal.js';
import Paper from './components/Paper.js';
import Popover from './components/Popover.js';
import Popper from './components/Popper.js';
import Radio from './components/Radio.js';
import Select from './components/Select.js';
import Stack from './components/Stack.js';
import Switch from './components/Switch.js';
import Toolbar from './components/Toolbar.js';
import Tooltip from './components/Tooltip.js';
import Typography from './components/Typography.js';
import FilledInput from './components/text-fields/FilledInput.js';
import FormControl from './components/text-fields/FormControl.js';
import FormControlLabel from './components/text-fields/FormControlLabel.js';
import FormHelperText from './components/text-fields/FormHelperText.js';
import Input, { InputBase } from './components/text-fields/Input.js';
import InputAdornment from './components/text-fields/InputAdornment.js';
import InputLabel from './components/text-fields/InputLabel.js';
import OutlinedInput from './components/text-fields/OutlinedInput.js';
import TextField from './components/text-fields/TextField.js';
import mixins from './mixins.js';
import { darkPalettes, lightPalettes } from './palettes/index.js';
import { applyPrimaryOverride } from './primaryColorOverride.js';
import shadows, { darkShadows } from './shadows.js';
import sxConfig from './sxConfig.js';
import createTypography from './typography.js';

export function createTheme(preset: ThemePreset, primaryColor: string | null) {
  return muiCreateTheme({
    cssVariables: { colorSchemeSelector: 'data-holita-color-scheme', cssVarPrefix: 'holita' },
    colorSchemes: {
      light: {
        palette: applyPrimaryOverride(
          lightPalettes[preset] ?? lightPalettes['default-light'],
          primaryColor,
          'light',
        ),
        shadows: ['none', ...shadows],
      },
      dark: {
        palette: applyPrimaryOverride(
          darkPalettes[preset] ?? darkPalettes['default-dark'],
          primaryColor,
          'dark',
        ),
        shadows: ['none', ...shadows.map(() => darkShadows[0] ?? 'none')],
      },
    },
    shadows: ['none', ...shadows],
    typography: createTypography(),
    unstable_sxConfig: sxConfig,
    mixins,
    components: {
      MuiTableContainer: TableContainer,
      MuiTableRow: TableRow,
      MuiTableHead: TableHead,
      MuiTableCell: TableCell,
      MuiDataGrid: DataGrid,
      MuiAutocomplete: Autocomplete,
      MuiCheckbox: Checkbox,
      MuiTab: Tab,
      MuiTabs: Tabs,
      MuiAppBar: AppBar,
      MuiPaper: Paper,
      MuiDivider: Divider,
      MuiButton: Button,
      MuiButtonBase: ButtonBase,
      MuiTextField: TextField,
      MuiFilledInput: FilledInput,
      MuiOutlinedInput: OutlinedInput,
      MuiInputLabel: InputLabel,
      MuiInputAdornment: InputAdornment,
      MuiFormHelperText: FormHelperText,
      MuiInput: Input,
      MuiInputBase: InputBase,
      MuiFormControl: FormControl,
      MuiFormControlLabel: FormControlLabel,
      MuiBreadcrumbs: Breadcrumbs,
      MuiSelect: Select,
      MuiDialog: Dialog,
      MuiStack: Stack,
      MuiRadio: Radio,
      MuiChip: Chip,
      MuiSwitch: Switch,
      MuiList: List,
      MuiListItemButton: ListItemButton,
      MuiListItemIcon: ListItemIcon,
      MuiListItemText: ListItemText,
      MuiModal: Modal,
      MuiMenuItem: MenuItem,
      MuiToolbar: Toolbar,
      MuiTooltip: Tooltip,
      MuiTypography: Typography,
      MuiAvatar: Avatar,
      MuiCssBaseline: CssBaseline,
      MuiLink: Link,
      MuiBackdrop: Backdrop,
      MuiPopover: Popover,
      MuiPopper: Popper,
      MuiDrawer: Drawer,
    },
  });
}
