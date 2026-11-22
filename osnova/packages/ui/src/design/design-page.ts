import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UI_LANGUAGE } from '../ui/ui-language';
import { ThemeMenu } from '../ui/theme-menu/theme-menu';
import { SignIn } from '../ui/sign-in/sign-in';
import { PageHeader } from '../ui/page-header/page-header';
import { KpiStrip } from '../ui/kpi/kpi-strip';
import { KpiTile } from '../ui/kpi/kpi-tile';
import { FilterBuilder } from '../ui/filter-builder/filter-builder';
import { trackById } from '../ui/list/list-actions';
import type { ListQuery } from '../ui/list/list-query';
import { ListSortMenu } from '../ui/list/list-sort-menu';
import { TablePanel, type TableColumn } from '../ui/table-panel/table-panel';
import type { TableView } from '../ui/table-panel/table-view';
import { RowActions } from '../ui/row-actions/row-actions';
import { FormField } from '../ui/form-field/form-field';
import { EmptyState } from '../ui/empty-state/empty-state';
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

const listingMessages = {
  bg: {
    title: 'Адаптивен списък',
    heading: 'Записи',
    state: 'Състояние на списъка',
    feedback: 'Съобщение за действие',
    rows: 'Записи без съобщение',
    'rows-error': 'Грешка при обновяване',
    loading: 'Зареждане',
    empty: 'Празен списък',
    name: 'Име',
    quantity: 'Брой',
    status: 'Състояние',
    actions: 'Действия',
    search: 'Търсене на записи',
    record: 'Архивна папка с протоколи от годишните проверки',
    badge: 'ОчакваПотвърждениеОтОтговорника',
    archive: 'Архивирай',
    actionError: 'Записът не може да бъде архивиран, докато е включен в текущ преглед.',
  },
  en: {
    title: 'Responsive listing',
    heading: 'Records',
    state: 'Listing state',
    feedback: 'Action feedback',
    rows: 'Rows without feedback',
    'rows-error': 'Refresh failure',
    loading: 'Loading',
    empty: 'Empty',
    name: 'Name',
    quantity: 'Count',
    status: 'Status',
    actions: 'Actions',
    search: 'Search records',
    record: 'Annual inspection reports and supporting documents',
    badge: 'Waiting for review',
    archive: 'Archive',
    actionError: 'This record cannot be archived while it belongs to an active review.',
  },
};

/** Development-only page: the tokens, every registered PrimeNG control and each shared pattern once. */
@Component({
  selector: 'osnova-design-page',
  imports: [
    FormsModule,
    ThemeMenu,
    SignIn,
    PageHeader,
    KpiStrip,
    KpiTile,
    FilterBuilder,
    ListSortMenu,
    TablePanel,
    RowActions,
    FormField,
    EmptyState,
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
  readonly activityLabel = input('Activity');
  readonly summaryLabel = input('Summary');
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
  readonly listingText = computed(() => listingMessages[this.language()]);
  readonly listingStates = ['feedback', 'rows', 'rows-error', 'loading', 'empty'] as const;
  readonly listingState = signal<(typeof this.listingStates)[number]>('feedback');
  readonly listingView = computed<TableView>(() => {
    const state = this.listingState();
    return { kind: state === 'feedback' ? 'rows' : state };
  });
  readonly listingFeedback = computed(() => {
    const state = this.listingState();
    return state === 'feedback' || state === 'rows-error' ? this.listingText().actionError : null;
  });
  readonly listingColumns = computed<readonly TableColumn[]>(() => {
    const text = this.listingText();
    return [
      {
        id: 'name',
        label: text.name,
        width: 'auto',
        kind: 'identity',
        className: 'app-col-identity',
      },
      { id: 'quantity', label: text.quantity, width: '5rem', kind: 'number' },
      {
        id: 'status',
        label: text.status,
        width: '15rem',
        kind: 'status',
        className: 'app-table-merged-column',
      },
      {
        id: 'actions',
        label: text.actions,
        width: '3.25rem',
        kind: 'actions',
        className: 'app-col-actions',
      },
    ];
  });
  readonly listingRecords = computed(() => [
    { id: 'archive-2026', label: this.listingText().record, unavailable: [] },
  ]);
  readonly listingActions = computed(() => [{ id: 'archive', label: this.listingText().archive }]);
  readonly listingSort = signal<NonNullable<ListQuery['sort']>>({
    field: 'name',
    direction: 'asc',
  });
  readonly trackById = trackById;
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
