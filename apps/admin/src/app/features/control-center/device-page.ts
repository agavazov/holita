import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  afterNextRender,
  Injector,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { TableModule, type Table, type TableLazyLoadEvent } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { map, type Observable } from 'rxjs';
import type {
  AdminControlCenterDeviceQuery,
  AdminControlCenterEventsQuery,
  AdminControlCenterFramesQuery,
  AdminControlCenterSnapshotsQuery,
  AdminControlCenterDeviceProblemsQuery,
  ErmEventCategory,
  ErmFrameDirection,
  ErmFrameChecksum,
  ErmEventSeverity,
  ErmParameterReadOutcome,
  ErmParameterSnapshotStatus,
  FleetWarningLampState,
  ErmKarmaReturnStatus,
  FleetProblemSortField,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { DemoSession } from '../../core/auth/demo-session';
import type { Language } from '../../i18n/messages';
import { injectPageRecord } from '../../layout/page-record';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { FleetNow } from '../../ui/fleet-live/fleet-now';
import { FleetLastReport } from '../../ui/fleet-live/fleet-last-report';
import { FleetCurrentWarnings } from '../../ui/fleet-live/fleet-current-warnings';
import { FleetFaultCoverage } from '../../ui/fleet-live/fleet-fault-coverage';
import {
  faultsText,
  faultDescription,
  faultFmi,
  faultSystem,
} from '../../ui/fleet-live/fault-wording';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { formatDuration, formatNumber } from '../../ui/format/format';
import { interpolate, uiMessages } from '../../ui/i18n/messages';
import { trackById, type ListActionBase, type ListRecord } from '../../ui/list/list-actions';
import { injectSortReady, type ListQuery } from '../../ui/list/list-query';
import { ListSortMenu, type ListSortField } from '../../ui/list/list-sort-menu';
import { LocationMap, type LocationMapRecord } from '../../ui/location-map/location-map';
import { mapCoordinates } from '../../ui/map-preview/location-map';
import { PageHeader } from '../../ui/page-header/page-header';
import { RowActions } from '../../ui/row-actions/row-actions';
import { TablePanel, type TableColumn } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { deviceModelLabel } from '../fleet/devices/i18n/messages';
import { ControlCenterApi } from './control-center-api';
import {
  controlCenterText,
  controlCenterError,
  ermLanguage,
  returnToDiscoCanError,
  severityTone,
} from './control-center-text';
import { DeviceCommandQueue } from './device-command-queue';
import { DeviceConsole } from './device-console';
import { DeviceSettings } from './device-settings';
import { SmsPage } from './sms-page';
import { FilterBuilder } from '../../ui/filter-builder/filter-builder';
import type { FilterCondition, FilterField } from '../../ui/filter-builder/filter-model';
import { UrlListState } from '../../ui/list/url-list-state';
import { eventDefinition, frameDefinition, snapshotDefinition } from './device-events-query';
import { deviceProblemDefinition } from './device-problems-query';
import { problemSeverities, problemStates } from '../fleet/overview/problems-query';

export type DeviceTab =
  | 'overview'
  | 'problems'
  | 'commands'
  | 'console'
  | 'sms-commands'
  | 'parameters'
  | 'events'
  | 'frames';
export const deviceTabs: readonly DeviceTab[] = [
  'overview',
  'problems',
  'commands',
  'console',
  'sms-commands',
  'parameters',
  'events',
  'frames',
];
type Device = AdminControlCenterDeviceQuery['fleetDevice'];
type Events = AdminControlCenterEventsQuery['fleetDevice']['ermEvents'];
type Frames = AdminControlCenterFramesQuery['fleetDevice']['ermFrames'];
type Snapshots = AdminControlCenterSnapshotsQuery['fleetDevice']['ermParameterSnapshots'];
type Problems = AdminControlCenterDeviceProblemsQuery['fleetProblems'];
type Detail =
  | { kind: 'event'; value: Events['items'][number] }
  | { kind: 'frame'; value: Frames['items'][number] }
  | { kind: 'snapshot'; value: Snapshots['items'][number] }
  | { kind: 'problem'; value: Problems['items'][number] };
interface HistoryRead {
  loading: boolean;
  error: unknown;
  data: { events: Events } | { frames: Frames } | { snapshots: Snapshots } | null;
}

@Component({
  selector: 'discocan-control-center-device',
  imports: [
    JsonPipe,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    Dialog,
    Message,
    Skeleton,
    TableModule,
    FilterBuilder,
    ListSortMenu,
    Tag,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    EmptyState,
    FleetNow,
    FleetLastReport,
    FleetCurrentWarnings,
    FleetFaultCoverage,
    LocationMap,
    PageHeader,
    RowActions,
    TablePanel,
    DeviceCommandQueue,
    DeviceConsole,
    DeviceSettings,
    SmsPage,
  ],
  providers: [ControlCenterApi, ConfirmationService],
  templateUrl: './device-page.html',
  styleUrl: './control-center.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicePage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  readonly recordId = input.required<string>();
  readonly tab = input.required<DeviceTab>();
  readonly text = computed(() => controlCenterText[this.language()]);
  readonly moduleInfo = computed(() => {
    const tab = this.tab();
    return this.text().moduleInfo[tab === 'sms-commands' ? 'smsCommands' : tab];
  });
  readonly tabTitle = computed(() => {
    const tab = this.tab();
    return tab === 'events' || tab === 'frames'
      ? this.text().tabs[tab]
      : this.text().detail.tabs[tab];
  });
  readonly uiText = computed(() => uiMessages[this.language()]);
  readonly faultText = computed(() => faultsText(this.language()));
  readonly faultDescription = faultDescription;
  readonly faultFmi = faultFmi;
  readonly faultSystem = faultSystem;
  readonly fmt = injectFleetFormat();
  readonly primaryTabs = [
    'overview',
    'problems',
    'commands',
    'console',
    'sms-commands',
    'parameters',
    'technical-details',
  ] as const;
  readonly activeTab = computed(() =>
    this.tab() === 'events' || this.tab() === 'frames' ? 'technical-details' : this.tab(),
  );
  readonly trackById = trackById;
  readonly toneSeverity = toneSeverity;
  readonly severityTone = severityTone;
  readonly categories: readonly ErmEventCategory[] = [
    'POSITION',
    'STATUS',
    'ALARM',
    'EDATA',
    'OTHER',
  ];
  readonly directions: readonly ErmFrameDirection[] = ['DEVICE', 'UPSTREAM', 'DISCOCAN'];
  readonly checksums: readonly ErmFrameChecksum[] = ['OK', 'MISMATCH', 'ABSENT'];
  private readonly api = inject(ControlCenterApi);
  private readonly session = inject(DemoSession);
  readonly canOperate = computed(() => this.session.hasRole('OPERATOR'));
  readonly canConfigure = computed(() => this.session.hasRole('ENGINEER'));
  private readonly destroy = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notifications = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly requestedCommand = computed(() => this.queryParams().get('request'));
  readonly device = signal<Device | null>(null);
  readonly deviceLoading = signal(true);
  readonly deviceUpdatedAt = signal<string | null>(null);
  readonly deviceError = signal<unknown>(null);
  readonly failure = computed(() =>
    requestError(this.deviceError(), this.text().deviceUnavailable),
  );
  readonly state = computed(() => this.device()?.ermState ?? null);
  readonly connection = computed(() => {
    const state = this.state();
    const labels = this.text().deviceStatus.connectionStates;
    if (state?.online) {
      return state.lastFrameAt && !state.health.overdue
        ? { label: labels.LIVE, severity: toneSeverity('success') }
        : { label: labels.CONNECTED, severity: toneSeverity('info') };
    }
    if (state?.lastFrameAt) {
      return state.health.overdue
        ? { label: labels.OFFLINE, severity: toneSeverity('warn') }
        : { label: labels.REPORTING, severity: toneSeverity('warn') };
    }
    return { label: labels.UNKNOWN, severity: toneSeverity('neutral') };
  });
  readonly routing = computed(() => this.device()?.ermRouting ?? null);
  readonly returning = signal(false);
  readonly returnFailure = signal<string | null>(null);
  readonly returnDisabledReason = computed(() => {
    const route = this.routing();
    const text = this.text().deviceStatus;
    if (!this.canConfigure()) {
      return text.returnEngineer;
    }
    if (this.returning()) {
      return text.returnSubmitting;
    }
    if (route?.latestReturnAttempt?.pending) {
      return text.returnPending;
    }
    if (route?.state !== 'KARMA_BACKUP') {
      return text.returnBackupRequired;
    }
    return route.parked === true
      ? null
      : route.parked === false
        ? text.returnNotParked
        : text.returnParkingUnknown;
  });
  readonly recovery = computed(() => {
    const attempt = this.routing()?.latestReturnAttempt;
    return attempt ? attempt.recovery : (this.state()?.recovery ?? null);
  });
  readonly firmwareComparison = computed(() => {
    const observed = this.state()?.firmwareVersion?.value;
    const registered = this.device()?.firmwareVersion;
    return !observed || !registered ? 'UNKNOWN' : observed === registered ? 'MATCH' : 'DIFFERENT';
  });
  readonly warningLamps = computed(() =>
    ([1896, 1906, 1910] as const).map((parameterId) => {
      const lamp = this.device()?.warningLamps.find((row) => row.parameterId === parameterId);
      return {
        parameterId,
        name: this.text().deviceStatus.lampNames[parameterId],
        state: lamp?.state ?? 'UNKNOWN',
        recordedAt: lamp?.recordedAt ?? null,
      };
    }),
  );
  readonly title = computed(
    () => this.device()?.vehicle?.licensePlate ?? this.device()?.imei ?? this.text().devices,
  );
  readonly unitName = computed(() => `${this.title()} · IMEI ${this.device()?.imei ?? '—'}`);
  readonly canSend = computed(
    () => this.state()?.online === true && this.state()?.mode === 'PRIMARY',
  );
  readonly mapRecords = computed<readonly LocationMapRecord[]>(() => {
    const device = this.device();
    if (!device) {
      return [];
    }
    const state = device.ermState;
    const position = state?.lastPosition;
    const live = state?.online === true && !state.health.overdue;
    return [
      {
        id: device.id,
        label: device.imei,
        plate: device.vehicle?.licensePlate ?? null,
        position: mapCoordinates(position?.latitude, position?.longitude),
        positionAt: position?.positionTime ?? position?.eventTime ?? null,
        heading: position?.heading ?? null,
        speedKph: position?.speedKmh ?? null,
        status: {
          label: live
            ? this.text().detail.live
            : state?.online
              ? this.text().detail.connected
              : this.text().detail.disconnected,
          tone: live ? 'success' : state?.online ? 'info' : 'neutral',
        },
      },
    ];
  });
  private readonly reload = signal(0);
  readonly problemList = new UrlListState(
    deviceProblemDefinition,
    () => this.route.snapshot.paramMap.get('tab') === 'problems',
  );
  private readonly problemsSortReady = injectSortReady();
  readonly problems = signal<Problems | null>(null);
  readonly problemRows = computed(() =>
    (this.problems()?.items ?? []).map((problem) => {
      const first = problem.diagnostics[0];
      const firstObserved = problem.diagnostics
        .map((diagnostic) => diagnostic.firstObservedAt)
        .sort()[0];
      const lastObserved = problem.diagnostics
        .map((diagnostic) => diagnostic.lastObservedAt)
        .sort()
        .at(-1);
      return {
        ...problem,
        title: first ? faultDescription(first, this.language()) : this.problemLabel(problem),
        summary: first
          ? [
              first.troubleCode,
              first.fmi === null ? null : faultFmi(first.fmi, this.language()),
              problem.diagnostics.length > 1 ? `+${String(problem.diagnostics.length - 1)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : (problem.details ?? this.problemLabel(problem)),
        system: first ? faultSystem(first.systemKey, this.language()) : '—',
        firstObserved: firstObserved ?? problem.occurredAt,
        lastObserved: lastObserved ?? problem.occurredAt,
      };
    }),
  );
  readonly problemConditions = computed<readonly FilterCondition[]>(() => {
    const filter = this.problemList.state().filter;
    return [
      ...(filter.severity?.length
        ? [
            {
              id: 'problem-severity',
              field: 'severity',
              operator: 'isAnyOf' as const,
              values: filter.severity,
            },
          ]
        : []),
      ...(filter.state?.length
        ? [
            {
              id: 'problem-state',
              field: 'state',
              operator: 'isAnyOf' as const,
              values: filter.state,
            },
          ]
        : []),
    ];
  });
  readonly problemFields = computed<readonly FilterField[]>(() => [
    {
      key: 'severity',
      label: this.text().severity,
      type: 'enum',
      operators: ['isAnyOf'],
      options: problemSeverities.map((value) => ({ value, label: this.severityLabel(value) })),
    },
    {
      key: 'state',
      label: this.text().status,
      type: 'enum',
      operators: ['isAnyOf'],
      options: problemStates.map((value) => ({ value, label: this.problemState(value) })),
    },
  ]);
  readonly problemSortFields = computed<readonly ListSortField[]>(() => [
    { field: 'SOURCE', label: this.text().source },
    { field: 'TIME', label: this.text().time },
    { field: 'SEVERITY', label: this.text().severity },
    { field: 'STATE', label: this.text().status },
  ]);
  readonly problemSort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.problemList.state().sort.field,
    direction: this.problemList.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  readonly problemsLoading = signal(true);
  readonly problemsError = signal<unknown>(null);
  readonly problemView = computed(() =>
    tableView({
      loading: this.problemsLoading() && !this.problems(),
      error: this.problemsError(),
      rows: this.problems()?.items.length ?? null,
      filtered: this.problemConditions().length > 0,
    }),
  );
  readonly hasFaultReports = computed<boolean | null>(() => {
    const problems = this.problems();
    if (!problems) {
      return null;
    }
    if (
      problems.items.some((problem) =>
        problem.diagnostics.some((diagnostic) => diagnostic.kind === 'DIAGNOSTIC_TROUBLE_CODE'),
      )
    ) {
      return true;
    }
    return problems.total === problems.items.length ? false : null;
  });
  readonly problemFailure = computed(() =>
    requestError(this.problemsError(), this.text().unavailable),
  );
  readonly hasProblems = computed(() => {
    const counts = this.problems()?.counts;
    return (
      (this.device()?.currentWarnings.length ?? 0) > 0 ||
      (counts?.requiringAttention ?? 0) > 0 ||
      (counts?.recorded ?? 0) > 0
    );
  });
  readonly problemSummary = computed(() =>
    this.problems()
      ? interpolate(this.text().detail.problemSummary, {
          warnings: this.device()?.currentWarnings.length ?? 0,
          attention: this.problems()?.counts.requiringAttention ?? 0,
          recorded: this.problems()?.counts.recorded ?? 0,
        })
      : this.text().detail.problemsUnknown,
  );
  readonly eventList = new UrlListState(
    eventDefinition,
    () => this.route.snapshot.paramMap.get('tab') === 'events',
  );
  readonly eventSortFields = computed<readonly ListSortField[]>(() => [
    { field: 'TIME', label: this.text().time },
    { field: 'EVENT_TYPE', label: this.text().event },
    { field: 'STATUS', label: this.text().severity },
  ]);
  readonly eventSort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: this.eventList.state().sort.field,
    direction: this.eventList.state().sort.direction === 'ASC' ? 'asc' : 'desc',
  }));
  private readonly injector = inject(Injector);
  private eventsSortReady = false;
  private readonly technicalTable = viewChild<Table>('technicalTable');
  readonly category = computed(() => this.eventList.state().filter.category || null);
  readonly eventConditions = computed<readonly FilterCondition[]>(() => {
    const values = this.eventList.state().filter.statuses ?? [];
    return values.length
      ? [{ id: 'event-status', field: 'severity', operator: 'isAnyOf', values }]
      : [];
  });
  readonly eventFields = computed<readonly FilterField[]>(() => [
    {
      key: 'severity',
      label: this.text().severity,
      type: 'enum',
      operators: ['isAnyOf'],
      options: (['INFO', 'WARNING', 'CRITICAL'] as const).map((value) => ({
        value,
        label: this.text().severities[value],
      })),
    },
  ]);
  readonly direction = signal<ErmFrameDirection | null>(null);
  readonly checksum = signal<ErmFrameChecksum | null>(null);
  readonly frameList = new UrlListState(
    frameDefinition,
    () => this.route.snapshot.paramMap.get('tab') === 'frames',
  );
  readonly snapshotList = new UrlListState(
    snapshotDefinition,
    () => this.route.snapshot.paramMap.get('tab') === 'parameters',
  );
  private readonly snapshotsSortReady = injectSortReady();
  readonly timeSortFields = computed<readonly ListSortField[]>(() => [
    {
      field: 'TIME',
      label: this.tab() === 'frames' ? this.text().received : this.text().snapshots.startedAt,
    },
  ]);
  readonly timeSort = computed<NonNullable<ListQuery['sort']>>(() => ({
    field: 'TIME',
    direction:
      (this.tab() === 'frames' ? this.frameList : this.snapshotList).state().sort.direction ===
      'ASC'
        ? 'asc'
        : 'desc',
  }));
  readonly events = signal<Events | null>(null);
  readonly frames = signal<Frames | null>(null);
  readonly snapshots = signal<Snapshots | null>(null);
  readonly completedSnapshotId = computed(
    () => this.snapshots()?.items.find((snapshot) => snapshot.status !== 'RUNNING')?.id ?? null,
  );
  readonly historyLoading = signal(false);
  readonly historyError = signal<unknown>(null);
  readonly historyFailure = computed(() =>
    requestError(this.historyError(), this.text().unavailable),
  );
  readonly history = computed(() =>
    this.tab() === 'events'
      ? this.events()
      : this.tab() === 'frames'
        ? this.frames()
        : this.snapshots(),
  );
  readonly filteredFrames = computed(
    () =>
      this.frames()?.items.filter(
        (row) =>
          (!this.direction() || row.direction === this.direction()) &&
          (!this.checksum() || row.checksum === this.checksum()),
      ) ?? [],
  );
  readonly technicalRows = computed<(Events['items'][number] | Frames['items'][number])[]>(() =>
    this.tab() === 'events' ? (this.events()?.items ?? []) : this.filteredFrames(),
  );
  readonly historyView = computed(() =>
    tableView({
      loading: this.historyLoading() && !this.history(),
      error: this.historyError(),
      rows:
        this.tab() === 'frames'
          ? this.frames()
            ? this.filteredFrames().length
            : null
          : (this.history()?.items.length ?? null),
      filtered:
        !!this.category() ||
        this.eventConditions().length > 0 ||
        !!this.direction() ||
        !!this.checksum(),
    }),
  );
  readonly historyPage = computed(() => {
    const tab = this.tab();
    const state =
      tab === 'events'
        ? this.eventList.state()
        : tab === 'frames'
          ? this.frameList.state()
          : this.snapshotList.state();
    return { page: state.page, pageSize: state.pageSize, total: this.history()?.total ?? 0 };
  });
  readonly detail = signal<Detail | null>(null);
  readonly actions = computed<readonly ListActionBase<'details'>[]>(() => [
    { id: 'details', label: this.text().detail.details },
  ]);
  readonly snapshotRunning = computed(
    () => this.snapshots()?.items.some((row) => row.status === 'RUNNING') ?? false,
  );
  readonly startingSnapshot = signal(false);
  readonly actionConfirmation = signal('');
  readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'erm-device-confirm-message'),
  );
  readonly columns = computed<readonly TableColumn[]>(() =>
    this.tab() === 'events'
      ? [
          {
            id: 'event',
            label: this.text().event,
            width: '20rem',
            kind: 'identity',
            className: 'app-col-identity',
          },
          { id: 'time', label: this.text().time, width: '12rem', kind: 'date' },
          { id: 'category', label: this.text().category, width: '9rem', kind: 'text' },
          { id: 'severity', label: this.text().severity, width: '9rem', kind: 'status' },
          {
            id: 'actions',
            label: this.text().detail.actions,
            width: '5rem',
            kind: 'actions',
            className: 'app-col-actions',
          },
        ]
      : this.tab() === 'frames'
        ? [
            {
              id: 'frame',
              label: this.text().frame,
              width: '22rem',
              kind: 'identity',
              className: 'app-col-identity',
            },
            { id: 'time', label: this.text().received, width: '12rem', kind: 'date' },
            { id: 'direction', label: this.text().direction, width: '9rem', kind: 'text' },
            { id: 'checksum', label: this.text().checksum, width: '9rem', kind: 'status' },
            {
              id: 'actions',
              label: this.text().detail.actions,
              width: '5rem',
              kind: 'actions',
              className: 'app-col-actions',
            },
          ]
        : [
            {
              id: 'time',
              label: this.text().snapshots.startedAt,
              width: '14rem',
              kind: 'identity',
              className: 'app-col-identity',
            },
            { id: 'status', label: this.text().status, width: '10rem', kind: 'status' },
            { id: 'read', label: this.text().snapshots.progress, width: '9rem', kind: 'number' },
            {
              id: 'changes',
              label: this.text().snapshots.changesCount,
              width: '9rem',
              kind: 'number',
            },
            {
              id: 'actions',
              label: this.text().detail.actions,
              width: '5rem',
              kind: 'actions',
              className: 'app-col-actions',
            },
          ],
  );
  readonly problemColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'problem',
      label: this.text().detail.problem,
      width: '20rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'system', label: this.faultText().system, width: '11rem', kind: 'text' },
    { id: 'source', label: this.text().source, width: '9rem', kind: 'text' },
    { id: 'time', label: this.text().time, width: '15rem', kind: 'date' },
    { id: 'severity', label: this.text().severity, width: '9rem', kind: 'status' },
    { id: 'status', label: this.text().status, width: '11rem', kind: 'status' },
    {
      id: 'actions',
      label: this.text().detail.actions,
      width: '5rem',
      kind: 'actions',
      className: 'app-col-actions',
    },
  ]);
  readonly valueColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'parameter',
      label: this.text().snapshots.parameter,
      width: '18rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'value', label: this.text().snapshots.value, width: '24rem', kind: 'text' },
  ]);
  readonly changeColumns = computed<readonly TableColumn[]>(() => [
    {
      id: 'parameter',
      label: this.text().snapshots.parameter,
      width: '18rem',
      kind: 'identity',
      className: 'app-col-identity',
    },
    { id: 'before', label: this.text().snapshots.before, width: '18rem', kind: 'text' },
    { id: 'now', label: this.text().snapshots.now, width: '18rem', kind: 'text' },
  ]);

  constructor() {
    effect(() => {
      this.tab();
      const table = this.technicalTable();
      this.eventsSortReady = false;
      if (table) {
        afterNextRender(
          () => {
            this.eventsSortReady = true;
          },
          { injector: this.injector },
        );
      }
    });
    injectPageRecord(() => (this.device() ? this.title() : null));
    effect((onCleanup) => {
      this.reload();
      this.deviceLoading.set(true);
      const sub = this.api
        .watchDevice(this.recordId(), ermLanguage(this.language()))
        .valueChanges.subscribe({
          next: (result) => {
            this.deviceLoading.set(result.loading);
            this.deviceError.set(result.error ?? null);
            if (result.dataState === 'complete' && !result.error) {
              this.device.set(result.data.fleetDevice);
              this.deviceUpdatedAt.set(new Date().toISOString());
            }
          },
          error: (error: unknown) => {
            this.deviceLoading.set(false);
            this.deviceError.set(error);
          },
        });
      onCleanup(() => {
        sub.unsubscribe();
      });
    });
    effect((onCleanup) => {
      this.reload();
      const state = this.problemList.state();
      this.problemsLoading.set(true);
      const sub = this.api
        .watchDeviceProblems({
          id: this.recordId(),
          offset: (state.page - 1) * state.pageSize,
          limit: state.pageSize,
          severities: state.filter.severity ? [...state.filter.severity] : null,
          states: state.filter.state ? [...state.filter.state] : null,
          sort: state.sort,
        })
        .valueChanges.subscribe({
          next: (result) => {
            this.problemsLoading.set(result.loading);
            this.problemsError.set(result.error ?? null);
            if (result.dataState === 'complete' && !result.error) {
              this.problems.set(result.data.fleetProblems);
              if (this.tab() === 'problems') {
                this.problemList.correctPage(
                  Math.max(1, Math.ceil(result.data.fleetProblems.total / state.pageSize)),
                );
              }
            }
          },
          error: (error: unknown) => {
            this.problemsLoading.set(false);
            this.problemsError.set(error);
          },
        });
      onCleanup(() => {
        sub.unsubscribe();
      });
    });
    effect((onCleanup) => {
      this.reload();
      const tab = this.tab();
      const id = this.recordId();
      const category = this.category();
      const eventState = this.eventList.state();
      const frameState = this.frameList.state();
      const snapshotState = this.snapshotList.state();
      if (tab !== 'events' && tab !== 'frames' && tab !== 'parameters') {
        return;
      }
      this.historyLoading.set(true);
      this.historyError.set(null);
      const read: Observable<HistoryRead> =
        tab === 'events'
          ? this.api
              .watchEvents({
                id,
                language: ermLanguage(this.language()),
                input: {
                  pageSize: eventState.pageSize,
                  offset: (eventState.page - 1) * eventState.pageSize,
                  ...(category ? { categories: [category] } : {}),
                  ...(eventState.filter.statuses?.length
                    ? { severities: [...eventState.filter.statuses] }
                    : {}),
                  ...(eventState.sort.field === 'TIME' && eventState.sort.direction === 'DESC'
                    ? {}
                    : { sort: eventState.sort }),
                },
              })
              .valueChanges.pipe(
                map((result) => ({
                  loading: result.loading,
                  error: result.error,
                  data:
                    result.dataState === 'complete' && !result.error
                      ? { events: result.data.fleetDevice.ermEvents }
                      : null,
                })),
              )
          : tab === 'frames'
            ? this.api
                .watchFrames({
                  id,
                  input: {
                    pageSize: frameState.pageSize,
                    offset: (frameState.page - 1) * frameState.pageSize,
                    ...(frameState.sort.direction === 'ASC' ? { direction: 'ASC' as const } : {}),
                  },
                })
                .valueChanges.pipe(
                  map((result) => ({
                    loading: result.loading,
                    error: result.error,
                    data:
                      result.dataState === 'complete' && !result.error
                        ? { frames: result.data.fleetDevice.ermFrames }
                        : null,
                  })),
                )
            : this.api
                .watchSnapshots(
                  {
                    id,
                    input: {
                      pageSize: snapshotState.pageSize,
                      offset: (snapshotState.page - 1) * snapshotState.pageSize,
                      ...(snapshotState.sort.direction === 'ASC'
                        ? { direction: 'ASC' as const }
                        : {}),
                    },
                  },
                  () => !this.snapshotRunning(),
                )
                .valueChanges.pipe(
                  map((result) => ({
                    loading: result.loading,
                    error: result.error,
                    data:
                      result.dataState === 'complete' && !result.error
                        ? { snapshots: result.data.fleetDevice.ermParameterSnapshots }
                        : null,
                  })),
                );
      const sub = read.subscribe({
        next: (result) => {
          this.historyLoading.set(result.loading);
          this.historyError.set(result.error ?? null);
          if (result.data && 'events' in result.data) {
            this.events.set(result.data.events);
            this.eventList.correctPage(
              Math.max(1, Math.ceil(result.data.events.total / eventState.pageSize)),
            );
          }
          if (result.data && 'frames' in result.data) {
            this.frames.set(result.data.frames);
            this.frameList.correctPage(
              Math.max(1, Math.ceil(result.data.frames.total / frameState.pageSize)),
            );
          }
          if (result.data && 'snapshots' in result.data) {
            this.snapshots.set(result.data.snapshots);
            this.snapshotList.correctPage(
              Math.max(1, Math.ceil(result.data.snapshots.total / snapshotState.pageSize)),
            );
            const detail = untracked(this.detail);
            if (detail?.kind === 'snapshot') {
              const current = result.data.snapshots.items.find((row) => row.id === detail.value.id);
              if (current) {
                this.detail.set({ kind: 'snapshot', value: current });
              }
            }
          }
        },
        error: (error: unknown) => {
          this.historyLoading.set(false);
          this.historyError.set(error);
        },
      });
      onCleanup(() => {
        sub.unsubscribe();
      });
    });
  }
  private alive(): boolean {
    return !this.destroy.destroyed;
  }

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
  }
  link(...path: string[]): string[] {
    return ['/', this.language(), this.branchId(), ...path];
  }
  selectTab(value: string | number | undefined): void {
    const tab = value === 'technical-details' ? value : deviceTabs.find((tab) => tab === value);
    if (tab) {
      void this.router.navigate(this.deviceLink(tab));
    }
  }

  deviceLink(tab: DeviceTab | 'technical-details'): string[] {
    return this.link(
      'fleet',
      'devices',
      this.recordId(),
      ...(tab === 'events' || tab === 'frames' || tab === 'technical-details'
        ? ['technical-details', tab === 'frames' ? 'frames' : 'events']
        : [tab]),
    );
  }
  refresh(): void {
    this.reload.update((value) => value + 1);
  }
  modelLabel(model: string | null | undefined): string {
    return deviceModelLabel(this.language(), model);
  }
  number(value: number | null | undefined, fraction = 0): string {
    return formatNumber(value, this.language(), { fraction });
  }
  duration(value: number | null): string {
    return formatDuration(value, this.language());
  }
  voltage(value: number | null | undefined): string {
    return value == null
      ? '—'
      : interpolate(this.text().deviceStatus.voltage, { value: this.number(value, 1) });
  }
  gsmSignal(value: number | null | undefined): string {
    return value == null
      ? '—'
      : interpolate(this.text().deviceStatus.gsmValue, { value: this.number(value, 1) });
  }
  returnSeverity(value: ErmKarmaReturnStatus) {
    return toneSeverity(
      value === 'RETURNED'
        ? 'success'
        : value === 'FAILED'
          ? 'danger'
          : value === 'UNCERTAIN' || value === 'NEEDS_OPERATOR'
            ? 'warn'
            : 'info',
    );
  }
  lampSeverity(value: FleetWarningLampState) {
    return toneSeverity(
      value === 'RED'
        ? 'danger'
        : value === 'YELLOW'
          ? 'warn'
          : value === 'INFORMATION'
            ? 'info'
            : value === 'OFF'
              ? 'success'
              : 'neutral',
    );
  }
  record(id: string, label: string): ListRecord<'details'> {
    return { id, label, unavailable: [] };
  }
  selectCategory(value: ErmEventCategory | null): void {
    this.eventList.patchFilter({ category: value ?? '' });
  }
  filterEvents(conditions: readonly FilterCondition[]): void {
    const values = conditions[0]?.values ?? [];
    this.eventList.patchFilter({
      statuses: (['INFO', 'WARNING', 'CRITICAL'] as const).filter((status) =>
        values.includes(status),
      ),
    });
  }
  clearTechnicalFilters(): void {
    if (this.tab() === 'events') {
      this.eventList.clearFilters();
    }
    this.direction.set(null);
    this.checksum.set(null);
  }
  sortHistory(event: TableLazyLoadEvent): void {
    if (!this.eventsSortReady) {
      return;
    }
    if (this.tab() === 'frames') {
      this.frameList.sortFromTable({ field: 'time', order: event.sortOrder });
      return;
    }
    const sort = eventDefinition.sorts.find((sort) => sort.field === event.sortField);
    if (this.tab() === 'events' && sort) {
      this.eventList.sortFromTable({ field: sort.param, order: event.sortOrder });
    }
  }
  sortSnapshots(event: TableLazyLoadEvent): void {
    if (this.snapshotsSortReady()) {
      this.snapshotList.sortFromTable({ field: 'time', order: event.sortOrder });
    }
  }
  chooseTimeSort(sort: NonNullable<ListQuery['sort']>): void {
    (this.tab() === 'frames' ? this.frameList : this.snapshotList).setSort(
      'TIME',
      sort.direction === 'asc' ? 'ASC' : 'DESC',
    );
  }
  changeHistoryPage(page: { page: number; pageSize: number }): void {
    const tab = this.tab();
    (tab === 'events'
      ? this.eventList
      : tab === 'frames'
        ? this.frameList
        : this.snapshotList
    ).setPage(page);
  }

  filterProblems(conditions: readonly FilterCondition[]): void {
    const severity = conditions.find((condition) => condition.field === 'severity')?.values ?? [];
    const state = conditions.find((condition) => condition.field === 'state')?.values ?? [];
    this.problemList.patchFilter({
      severity: problemSeverities.filter((value) => severity.includes(value)),
      state: problemStates.filter((value) => state.includes(value)),
    });
  }

  chooseProblemSort(sort: NonNullable<ListQuery['sort']>): void {
    const field = deviceProblemDefinition.sorts.find((entry) => entry.field === sort.field)?.field;
    if (field) {
      this.problemList.setSort(field, sort.direction === 'asc' ? 'ASC' : 'DESC');
    }
  }

  chooseEventSort(sort: NonNullable<ListQuery['sort']>): void {
    const field = eventDefinition.sorts.find((entry) => entry.field === sort.field)?.field;
    if (field) {
      this.eventList.setSort(field, sort.direction === 'asc' ? 'ASC' : 'DESC');
    }
  }

  sortProblems(event: TableLazyLoadEvent): void {
    if (!this.problemsSortReady()) {
      return;
    }
    const sort = deviceProblemDefinition.sorts.find((sort) => sort.field === event.sortField);
    if (sort) {
      this.problemList.sortFromTable({ field: sort.param, order: event.sortOrder });
    }
  }

  problemSortField(column: string): FleetProblemSortField | null {
    switch (column) {
      case 'source':
        return 'SOURCE';
      case 'time':
        return 'TIME';
      case 'severity':
        return 'SEVERITY';
      case 'status':
        return 'STATE';
      default:
        return null;
    }
  }

  historySortField(column: string): string | null {
    if (this.tab() === 'frames') {
      return column === 'time' ? 'TIME' : null;
    }
    if (this.tab() !== 'events') {
      return null;
    }
    switch (column) {
      case 'event':
        return 'EVENT_TYPE';
      case 'time':
        return 'TIME';
      case 'severity':
        return 'STATUS';
      default:
        return null;
    }
  }
  openDetail(id: string | undefined): void {
    if (this.tab() === 'problems') {
      const row = this.problems()?.items.find((row) => row.id === id);
      if (row) {
        this.detail.set({ kind: 'problem', value: row });
      }
    } else if (this.tab() === 'events') {
      const row = this.events()?.items.find((row) => row.id === id);
      if (row) {
        this.detail.set({ kind: 'event', value: row });
      }
    } else if (this.tab() === 'frames') {
      const row = this.frames()?.items.find((row) => row.id === id);
      if (row) {
        this.detail.set({ kind: 'frame', value: row });
      }
    } else {
      const row = this.snapshots()?.items.find((row) => row.id === id);
      if (row) {
        this.detail.set({ kind: 'snapshot', value: row });
      }
    }
  }
  frameLabel(frame: Frames['items'][number]): string {
    const ack = frame.acknowledgement;
    return ack
      ? interpolate(this.text().detail.confirmation, {
          reference: ack.commandReference,
          result: ack.resultCode,
        })
      : this.text().detail.protocolMessage;
  }
  problemLabel(row: Problems['items'][number]): string {
    return this.text().detail.problemKinds[row.sourceKind];
  }
  problemLink(row: Problems['items'][number]): string[] | null {
    return row.alertId
      ? this.link('fleet', 'dashboard', 'problems', row.alertId)
      : row.commandRequestId
        ? this.deviceLink('commands')
        : null;
  }
  parameter(value: number): string {
    return String(value).padStart(4, '0');
  }
  snapshotOutcome(value: ErmParameterReadOutcome): string {
    return this.text().snapshots.outcomes[value];
  }
  snapshotTone(value: ErmParameterSnapshotStatus) {
    return toneSeverity(value === 'COMPLETE' ? 'success' : value === 'RUNNING' ? 'info' : 'danger');
  }
  problemState(value: Problems['items'][number]['state']): string {
    return this.text().detail.problemStates[value];
  }
  snapshotStatus(value: ErmParameterSnapshotStatus): string {
    return this.text().snapshots.statuses[value];
  }
  directionLabel(value: ErmFrameDirection): string {
    return this.text().directions[value];
  }
  checksumLabel(value: ErmFrameChecksum): string {
    return this.text().checksums[value];
  }
  categoryLabel(value: ErmEventCategory): string {
    return this.text().categories[value];
  }
  severityLabel(value: ErmEventSeverity): string {
    return this.text().severities[value];
  }
  async startSnapshot(): Promise<void> {
    if (
      !this.canConfigure() ||
      !this.canSend() ||
      this.snapshotRunning() ||
      this.startingSnapshot()
    ) {
      return;
    }
    const text = this.text();
    this.actionConfirmation.set(
      interpolate(text.snapshots.confirmMessage, { unit: this.unitName() }),
    );
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: text.snapshots.confirmHeader,
      acceptLabel: text.snapshots.start,
      danger: false,
    });
    if (!accepted || !this.alive()) {
      return;
    }
    this.startingSnapshot.set(true);
    try {
      await this.api.startSnapshot(this.recordId());
      if (this.alive()) {
        this.notifications.add({ severity: 'info', summary: text.snapshots.started });
      }
    } catch (error: unknown) {
      if (this.alive()) {
        this.notifications.add({
          severity: 'error',
          summary: text.snapshots.startFailed,
          detail: controlCenterError(error, this.language(), text.snapshots.startFailed),
        });
      }
    } finally {
      if (this.alive()) {
        this.startingSnapshot.set(false);
        this.refresh();
      }
    }
  }

  async returnToDiscoCan(): Promise<void> {
    if (this.returnDisabledReason()) {
      return;
    }
    const text = this.text().deviceStatus;
    const language = this.language();
    const deviceId = this.recordId();
    this.actionConfirmation.set(interpolate(text.returnConfirm, { unit: this.unitName() }));
    const accepted = await confirmAction(this.confirmation, language, {
      header: text.returnConfirmTitle,
      acceptLabel: text.returnButton,
      danger: false,
    });
    if (!accepted || !this.alive() || this.returnDisabledReason()) {
      return;
    }
    this.returning.set(true);
    this.returnFailure.set(null);
    try {
      const attempt = await this.api.returnToDiscoCan(deviceId);
      if (this.alive()) {
        this.device.update((device) =>
          device
            ? { ...device, ermRouting: { ...device.ermRouting, latestReturnAttempt: attempt } }
            : device,
        );
        this.notifications.add({
          severity: attempt.status === 'UNCERTAIN' || attempt.status === 'FAILED' ? 'warn' : 'info',
          summary: text.returnRecorded,
          detail: text.returnStates[attempt.status],
        });
      }
    } catch (error: unknown) {
      if (this.alive()) {
        this.returnFailure.set(returnToDiscoCanError(error, language));
      }
    } finally {
      if (this.alive()) {
        this.returning.set(false);
        this.refresh();
      }
    }
  }
}
