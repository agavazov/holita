import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UI_LANGUAGE } from '../ui/ui-language';
import { ThemeMenu } from '../ui/theme-menu/theme-menu';
import { PageHeader } from '../ui/page-header/page-header';
import { KpiStrip } from '../ui/kpi/kpi-strip';
import { KpiTile } from '../ui/kpi/kpi-tile';
import { FilterBuilder } from '../ui/filter-builder/filter-builder';
import { TablePanel } from '../ui/table-panel/table-panel';
import { RowActions } from '../ui/row-actions/row-actions';
import { FormField } from '../ui/form-field/form-field';
import { EmptyState } from '../ui/empty-state/empty-state';
import { FleetConnection } from '../ui/fleet-live/fleet-connection';
import { FleetLastReport } from '../ui/fleet-live/fleet-last-report';
import { FleetNow } from '../ui/fleet-live/fleet-now';
import { FleetCurrentWarnings } from '../ui/fleet-live/fleet-current-warnings';
import { FleetFaultCoverage } from '../ui/fleet-live/fleet-fault-coverage';
import { FleetLiveSummary } from '../ui/fleet-live/fleet-live-summary';
import { FaultScanner } from '../ui/fleet-live/fault-scanner';
import { FleetFaults } from '../ui/fleet-live/fleet-faults';
import { FormsModule } from '@angular/forms';
import { Search } from '@primeicons/angular/search';
import { AutoComplete } from 'primeng/autocomplete';
import { Avatar } from 'primeng/avatar';
import { Badge } from 'primeng/badge';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Chip } from 'primeng/chip';
import { DatePicker } from 'primeng/datepicker';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MeterGroup } from 'primeng/metergroup';
import { Paginator } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { Timeline } from 'primeng/timeline';
import { ToggleButton } from 'primeng/togglebutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ChartPanel } from '../ui/chart-panel/chart-panel';
import { selectMultiplePt } from '../ui/select-multiple';

const vehicles = Array.from({ length: 200 }, (_, index) => `CB ${String(1001 + index)} AX`);

/** Development-only page: the tokens, every registered PrimeNG control and each shared pattern once. */
@Component({
  selector: 'discocan-design-page',
  imports: [
    FormsModule,
    ThemeMenu,
    PageHeader,
    KpiStrip,
    KpiTile,
    FilterBuilder,
    TablePanel,
    RowActions,
    FormField,
    EmptyState,
    FleetConnection,
    FleetLastReport,
    FleetNow,
    FleetFaults,
    FleetCurrentWarnings,
    FleetFaultCoverage,
    FleetLiveSummary,
    FaultScanner,
    AutoComplete,
    Avatar,
    Badge,
    ButtonDirective,
    Checkbox,
    ChartPanel,
    Chip,
    DatePicker,
    IconField,
    InputIcon,
    InputNumber,
    InputText,
    Message,
    MeterGroup,
    Paginator,
    Search,
    Select,
    SelectButton,
    Skeleton,
    TableModule,
    Tabs,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    Textarea,
    Timeline,
    ToggleButton,
    ToggleSwitch,
  ],
  templateUrl: './design-page.html',
  styleUrl: './design-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: UI_LANGUAGE,
      useFactory: () =>
        signal(
          inject(ActivatedRoute).snapshot.paramMap.get('language') === 'en'
            ? ('en' as const)
            : ('bg' as const),
        ).asReadonly(),
    },
  ],
})
export class DesignPage {
  readonly colors = [
    '--p-primary-color',
    '--p-content-background',
    '--p-text-color',
    '--p-app-tone-success-solid',
    '--p-app-tone-warn-solid',
    '--p-app-tone-danger-solid',
    '--p-app-tone-info-solid',
  ];
  readonly textSizes = [
    '--p-app-text-xs',
    '--p-app-text-sm',
    '--p-app-text-base',
    '--p-app-text-md',
    '--p-app-text-lg',
    '--p-app-text-title',
    '--p-app-text-kpi',
  ];
  readonly spaces = [1, 2, 3, 4, 5, 6, 8, 10].map((value) => `--p-app-space-${String(value)}`);
  readonly radii = [
    '--p-app-radius-frame',
    '--p-app-radius-panel',
    '--p-app-radius-control',
    '--p-app-radius-tag',
  ];
  readonly language = inject(UI_LANGUAGE);
  readonly actions = [
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete', danger: true },
  ] as const;
  readonly record = { id: '1', label: 'CB 1001 AX', unavailable: [] };
  readonly selectMultiplePt = selectMultiplePt;
  readonly schemes = ['light', 'dark'] as const;
  readonly vehicles = vehicles;
  readonly suggestions = vehicles.slice(0, 5);
  readonly statuses = ['Active', 'In service', 'Inactive'];
  readonly segments = [
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: 'Custom', value: 'custom' },
  ];
  readonly meter = [
    { label: 'Moving', value: 24, color: 'var(--p-app-tone-success-solid)' },
    { label: 'Idling', value: 11, color: 'var(--p-app-tone-warn-solid)' },
    { label: 'Parked', value: 41, color: 'var(--p-app-tone-info-solid)' },
  ];
  readonly rows = vehicles
    .slice(0, 3)
    .map((plate, index) => ({ plate, odometer: 412330 - index * 9000 }));
  readonly events = [{ title: 'Opened' }, { title: 'Acknowledged' }, { title: 'Resolved' }];
  date = new Date(2026, 9, 18);
  vehicle = vehicles[0];
  selected = [vehicles[0], vehicles[2]];
  segment = '7d';
  checked = true;
  toggled = true;
  amount = 650;
  status = 'Active';
}
