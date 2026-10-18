import { definePreset, type Preset } from '@primeuix/themes';
import AuraBase from '@primeuix/themes/aura/base';
import AutoComplete from '@primeuix/themes/aura/autocomplete';
import Avatar from '@primeuix/themes/aura/avatar';
import Badge from '@primeuix/themes/aura/badge';
import Button from '@primeuix/themes/aura/button';
import Checkbox from '@primeuix/themes/aura/checkbox';
import Chip from '@primeuix/themes/aura/chip';
import ConfirmDialog from '@primeuix/themes/aura/confirmdialog';
import DataTable from '@primeuix/themes/aura/datatable';
import DatePicker from '@primeuix/themes/aura/datepicker';
import Dialog from '@primeuix/themes/aura/dialog';
import Drawer from '@primeuix/themes/aura/drawer';
import IconField from '@primeuix/themes/aura/iconfield';
import InputNumber from '@primeuix/themes/aura/inputnumber';
import InputText from '@primeuix/themes/aura/inputtext';
import Listbox from '@primeuix/themes/aura/listbox';
import Message from '@primeuix/themes/aura/message';
import MeterGroup from '@primeuix/themes/aura/metergroup';
import Paginator from '@primeuix/themes/aura/paginator';
import Popover from '@primeuix/themes/aura/popover';
import Select from '@primeuix/themes/aura/select';
import SelectButton from '@primeuix/themes/aura/selectbutton';
import Skeleton from '@primeuix/themes/aura/skeleton';
import Tabs from '@primeuix/themes/aura/tabs';
import Tag from '@primeuix/themes/aura/tag';
import Textarea from '@primeuix/themes/aura/textarea';
import Timeline from '@primeuix/themes/aura/timeline';
import ToggleButton from '@primeuix/themes/aura/togglebutton';
import ToggleSwitch from '@primeuix/themes/aura/toggleswitch';
import Tooltip from '@primeuix/themes/aura/tooltip';
import VirtualScroller from '@primeuix/themes/aura/virtualscroller';
import { brands, paletteSteps, type Brand } from './brands';
import { densities, type Density } from './densities';
import {
  appCategoryTokens,
  appToneTokens,
  badgeToneTokens,
  buttonToneTokens,
  buttonVariantToneTokens,
  messageToneTokens,
  tagToneTokens,
} from './status-tones';
import type { ThemeChoice } from './theme-choice';

/**
 * The PrimeNG controls the admin renders plus the controls they render internally. Adding a
 * PrimeNG control means adding its preset here and to the "PrimeNG coverage" story.
 * `listbox` renders only in the Fleet RelationPicker. ProgressBar is not used: it renders an
 * `aria-level` attribute that a progress bar may not carry (axe `aria-allowed-attr`).
 */
export const registeredComponents = {
  autocomplete: AutoComplete,
  avatar: Avatar,
  badge: Badge,
  button: Button,
  checkbox: Checkbox,
  chip: Chip,
  confirmdialog: ConfirmDialog,
  datatable: DataTable,
  datepicker: DatePicker,
  dialog: Dialog,
  drawer: Drawer,
  iconfield: IconField,
  inputnumber: InputNumber,
  inputtext: InputText,
  listbox: Listbox,
  message: Message,
  metergroup: MeterGroup,
  paginator: Paginator,
  popover: Popover,
  select: Select,
  selectbutton: SelectButton,
  skeleton: Skeleton,
  tabs: Tabs,
  tag: Tag,
  textarea: Textarea,
  timeline: Timeline,
  togglebutton: ToggleButton,
  toggleswitch: ToggleSwitch,
  tooltip: Tooltip,
  virtualscroller: VirtualScroller,
};

function ramp(palette: string): Record<string, string> {
  const steps: Record<string, string> = {};
  for (const step of paletteSteps) steps[String(step)] = `{${palette}.${String(step)}}`;
  return steps;
}

function semanticTokens(brand: Brand, density: Density) {
  const { light, dark } = brand;
  return {
    transitionDuration: '0.15s',
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.color}',
      offset: '2px',
      shadow: 'none',
    },
    primary: {
      ...ramp(brand.primary),
      color: `light-dark({primary.${String(light.color)}}, {primary.${String(dark.color)}})`,
      contrastColor: 'light-dark(#ffffff, {surface.950})',
      hoverColor: `light-dark({primary.${String(light.hover)}}, {primary.${String(dark.hover)}})`,
      activeColor: `light-dark({primary.${String(light.active)}}, {primary.${String(dark.active)}})`,
    },
    // One neutral per brand in both schemes keeps the grey character stable across themes.
    surface: { 0: '#ffffff', ...ramp(brand.neutral) },
    highlight: {
      color: `light-dark({primary.${String(brand.emphasis)}}, rgba(255,255,255,.87))`,
      focusColor: `light-dark({primary.${String(Math.min(brand.emphasis + 100, 900))}}, rgba(255,255,255,.87))`,
    },
    content: {
      borderRadius: '{border.radius.lg}',
      borderColor: 'light-dark({surface.200}, {surface.800})',
    },
    formField: {
      paddingX: density.formField.paddingX,
      paddingY: density.formField.paddingY,
      // Component boundaries need 3:1 against the panel (WCAG 1.4.11).
      borderColor: 'light-dark(color-mix(in srgb, {surface.500}, {surface.400}), {surface.500})',
      hoverBorderColor: 'light-dark({surface.500}, {surface.400})',
    },
    list: { option: { padding: density.listOptionPadding } },
  };
}

function appTokens(brand: Brand, density: Density) {
  return {
    font: {
      family: "'Lato', system-ui, -apple-system, 'Segoe UI', sans-serif",
      numeric: 'tabular-nums',
    },
    text: {
      xs: '0.6875rem',
      sm: '0.75rem',
      table: density.table.bodyFontSize,
      base: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      title: density.app.titleSize,
      kpi: '1.625rem',
    },
    space: {
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      5: '1.25rem',
      6: '1.5rem',
      8: '2rem',
      10: '2.5rem',
    },
    radius: {
      frame: '{border.radius.xl}',
      panel: '{border.radius.lg}',
      control: '{border.radius.md}',
      tag: '{border.radius.sm}',
    },
    shadow: {
      floating: '0 8px 24px -8px rgb(0 0 0 / 0.2), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
    },
    canvas: {
      background: 'light-dark({surface.100}, {surface.950})',
      mutedColor: 'light-dark({surface.600}, {surface.400})',
    },
    frame: {
      background: 'light-dark({surface.0}, {surface.900})',
      borderColor: '{content.border.color}',
      gap: '0.5rem',
      radius: '{app.radius.frame}',
    },
    sidebar: {
      width: '15.5rem',
      railWidth: '4rem',
      item: {
        color: '{text.color}',
        mutedColor: '{app.canvas.muted.color}',
        hoverBackground: 'light-dark({surface.200}, {surface.800})',
        activeBackground: '{app.frame.background}',
        activeColor: '{text.color}',
        indicator: '{primary.color}',
      },
    },
    topbar: { height: density.app.topbarHeight },
    content: { maxWidth: '100rem' },
    gutter: density.app.gutter,
    gutterNarrow: '1rem',
    panel: {
      background: '{content.background}',
      borderColor: '{content.border.color}',
      headerBackground: 'light-dark({surface.50}, {surface.900})',
      padding: density.app.panelPadding,
      radius: '{app.radius.panel}',
    },
    stack: { gap: density.app.stackGap },
    control: { height: density.app.controlHeight },
    row: { height: density.app.rowHeight },
    drawer: { width: { md: '35rem', lg: '45rem' } },
    kpi: { minWidth: '10.5rem' },
    tone: appToneTokens(brand),
    category: appCategoryTokens(),
  };
}

function componentTokens(brand: Brand, density: Density) {
  const button = {
    root: {
      paddingX: density.button.paddingX,
      paddingY: density.button.paddingY,
      ...buttonToneTokens(),
    },
    ...buttonVariantToneTokens(),
  };
  // Unselected segment and toggle labels sit on surface 100, where Aura's muted 500 fails AA.
  const togglebutton = {
    root: { color: 'light-dark({surface.600}, {surface.400})' },
    icon: { color: 'light-dark({surface.600}, {surface.400})' },
  };
  const datatable = {
    headerCell: {
      padding: density.table.headerCellPadding,
      background: '{app.panel.header.background}',
      color: '{text.muted.color}',
    },
    columnTitle: { fontSize: density.table.columnTitleFontSize, fontWeight: '600' },
    bodyCell: { padding: density.table.bodyCellPadding, fontSize: density.table.bodyFontSize },
    row: { hoverBackground: 'light-dark({surface.50}, {surface.800})' },
  };
  const drawer = {
    header: { padding: '1rem 1.25rem' },
    title: { fontSize: '1.125rem', fontWeight: '600' },
    content: { padding: density.drawerContentPadding },
    footer: { padding: '0.75rem 1.25rem' },
  };
  const tag = {
    root: {
      fontSize: '0.75rem',
      fontWeight: '600',
      padding: '0.125rem 0.5rem',
      borderRadius: '{app.radius.tag}',
    },
    ...tagToneTokens(brand),
  };
  const tooltip = {
    root: {
      background: 'light-dark({surface.800}, {surface.100})',
      color: 'light-dark({surface.0}, {surface.900})',
    },
  };
  return {
    badge: badgeToneTokens(),
    button,
    datatable,
    drawer,
    message: messageToneTokens(),
    tag,
    togglebutton,
    tooltip,
  };
}

/**
 * Central rules that tokens alone cannot express: small uppercase column titles (also for plain
 * header cells without a sortable title), tabular numbers, the density row height, the tab bar
 * alignment and single-sided timelines.
 */
const presetCss = `
.p-datatable-thead > tr > th {
  font-size: var(--p-datatable-column-title-font-size);
  font-weight: var(--p-datatable-column-title-font-weight);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.p-timeline-event-opposite:empty {
  display: none;
}
.p-datatable-tbody > tr {
  height: var(--p-app-row-height);
}
.app-num,
.p-datatable .app-num {
  font-variant-numeric: var(--p-app-font-numeric);
}
.p-tablist-tab-list {
  gap: var(--p-app-space-1);
}
li.p-select-option,
li.p-autocomplete-option,
.p-datatable-tbody > tr,
th.p-datatable-header-cell {
  transition: none;
}
`;

/** The holita preset for one brand and density: standard Aura plus the holita tokens. */
export function holitaPreset(choice: ThemeChoice): Preset {
  const brand = brands[choice.brand];
  const density = densities[choice.density];
  const base: Preset = { ...AuraBase, components: registeredComponents };
  const holita: Preset = {
    semantic: semanticTokens(brand, density),
    components: componentTokens(brand, density),
    extend: { app: appTokens(brand, density) },
    css: presetCss,
  };
  return definePreset(base, holita);
}
