import type { Preset } from '@primeuix/themes';
import Base from '@primeuix/themes/aura-compat/base';
import Accordion from '@primeuix/themes/aura-compat/accordion';
import Badge from '@primeuix/themes/aura-compat/badge';
import Button from '@primeuix/themes/aura-compat/button';
import Checkbox from '@primeuix/themes/aura-compat/checkbox';
import ConfirmDialog from '@primeuix/themes/aura-compat/confirmdialog';
import DataTable from '@primeuix/themes/aura-compat/datatable';
import DatePicker from '@primeuix/themes/aura-compat/datepicker';
import Dialog from '@primeuix/themes/aura-compat/dialog';
import Drawer from '@primeuix/themes/aura-compat/drawer';
import IconField from '@primeuix/themes/aura-compat/iconfield';
import InputNumber from '@primeuix/themes/aura-compat/inputnumber';
import InputText from '@primeuix/themes/aura-compat/inputtext';
import Listbox from '@primeuix/themes/aura-compat/listbox';
import Message from '@primeuix/themes/aura-compat/message';
import Paginator from '@primeuix/themes/aura-compat/paginator';
import ProgressBar from '@primeuix/themes/aura-compat/progressbar';
import RadioButton from '@primeuix/themes/aura-compat/radiobutton';
import Ripple from '@primeuix/themes/aura-compat/ripple';
import Select from '@primeuix/themes/aura-compat/select';
import Tabs from '@primeuix/themes/aura-compat/tabs';
import Tag from '@primeuix/themes/aura-compat/tag';
import Textarea from '@primeuix/themes/aura-compat/textarea';
import ToggleSwitch from '@primeuix/themes/aura-compat/toggleswitch';
import Tooltip from '@primeuix/themes/aura-compat/tooltip';
import VirtualScroller from '@primeuix/themes/aura-compat/virtualscroller';

// Keep the original Aura tokens for our components and their PrimeNG dependencies.
// Individual preset exports avoid shipping tokens for unused demo components.
export const sakaiPreset: Preset = {
  ...Base,
  components: {
    accordion: Accordion,
    badge: Badge,
    button: Button,
    checkbox: Checkbox,
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
    paginator: Paginator,
    progressbar: ProgressBar,
    radiobutton: RadioButton,
    ripple: Ripple,
    select: Select,
    tabs: Tabs,
    tag: Tag,
    textarea: Textarea,
    toggleswitch: ToggleSwitch,
    tooltip: Tooltip,
    virtualscroller: VirtualScroller,
  },
  // Aura compat's transition rules for the option and table rows used by this app.
  css: `
    li.p-listbox-option,
    li.p-select-option,
    li.p-datatable-filter-constraint,
    .p-datatable .p-datatable-tbody > tr,
    th.p-datatable-header-cell,
    thead.p-datatable-thead > tr > th {
      transition: none;
    }
  `,
};
