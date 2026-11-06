import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
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
import { TableModule } from 'primeng/table';
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
  ErmParameterSnapshotStatus,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { injectPageRecord } from '../../layout/page-record';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { FleetConnection } from '../../ui/fleet-live/fleet-connection';
import { FleetNow } from '../../ui/fleet-live/fleet-now';
import { FleetLastReport } from '../../ui/fleet-live/fleet-last-report';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { formatDuration, formatNumber } from '../../ui/format/format';
import { interpolate, uiMessages } from '../../ui/i18n/messages';
import { trackById, type ListActionBase, type ListRecord } from '../../ui/list/list-actions';
import { LocationMap, type LocationMapRecord } from '../../ui/location-map/location-map';
import { mapCoordinates } from '../../ui/map-preview/location-map';
import { PageHeader } from '../../ui/page-header/page-header';
import { RowActions } from '../../ui/row-actions/row-actions';
import { TablePanel, type TableColumn } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { deviceModelLabel } from '../fleet/devices/i18n/messages';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText, ermLanguage, severityTone } from './control-center-text';
import { DeviceCommandQueue } from './device-command-queue';
import { DeviceSettings } from './device-settings';
import { SmsPage } from './sms-page';

export type DeviceTab =
  'overview' | 'problems' | 'commands' | 'sms-commands' | 'parameters' | 'events' | 'frames';
export const deviceTabs: readonly DeviceTab[] = [
  'overview',
  'problems',
  'commands',
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
  | { kind: 'snapshot'; value: Snapshots['items'][number] };
interface HistoryRead {
  loading: boolean;
  error: unknown;
  data: { events: Events } | { frames: Frames } | { snapshots: Snapshots } | null;
}

@Component({
  selector: 'holita-control-center-device',
  imports: [
    JsonPipe,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    Dialog,
    Message,
    Skeleton,
    TableModule,
    Tag,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    EmptyState,
    FleetConnection,
    FleetNow,
    FleetLastReport,
    LocationMap,
    PageHeader,
    RowActions,
    TablePanel,
    DeviceCommandQueue,
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
  readonly uiText = computed(() => uiMessages[this.language()]);
  readonly fmt = injectFleetFormat();
  readonly primaryTabs = [
    'overview',
    'problems',
    'commands',
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
  readonly directions: readonly ErmFrameDirection[] = ['DEVICE', 'UPSTREAM', 'HOLITA'];
  readonly checksums: readonly ErmFrameChecksum[] = ['OK', 'MISMATCH', 'ABSENT'];
  private readonly api = inject(ControlCenterApi);
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
  readonly problemPage = signal(1);
  readonly problems = signal<Problems | null>(null);
  readonly problemsLoading = signal(true);
  readonly problemsError = signal<unknown>(null);
  readonly problemView = computed(() =>
    tableView({
      loading: this.problemsLoading() && !this.problems(),
      error: this.problemsError(),
      rows: this.problems()?.items.length ?? null,
      filtered: false,
    }),
  );
  readonly problemFailure = computed(() =>
    requestError(this.problemsError(), this.text().unavailable),
  );
  readonly problemSummary = computed(() =>
    this.problems()
      ? interpolate(this.text().detail.problemSummary, {
          attention: this.problems()?.counts.requiringAttention ?? 0,
          recorded: this.problems()?.counts.recorded ?? 0,
        })
      : this.text().detail.problemsUnknown,
  );
  readonly category = signal<ErmEventCategory | null>(null);
  readonly direction = signal<ErmFrameDirection | null>(null);
  readonly checksum = signal<ErmFrameChecksum | null>(null);
  readonly cursors = linkedSignal<DeviceTab, readonly (string | null)[]>({
    source: this.tab,
    computation: () => [null],
  });
  readonly cursor = computed(() => this.cursors().at(-1) ?? null);
  readonly events = signal<Events | null>(null);
  readonly frames = signal<Frames | null>(null);
  readonly snapshots = signal<Snapshots | null>(null);
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
      filtered: !!this.category() || !!this.direction() || !!this.checksum(),
    }),
  );
  readonly cursorPage = computed(() => ({
    page: this.cursors().length,
    hasPrevious: this.cursors().length > 1,
    hasNext: !!this.history()?.hasMore,
  }));
  readonly detail = signal<Detail | null>(null);
  readonly actions = computed<readonly ListActionBase<'details'>[]>(() => [
    { id: 'details', label: this.text().detail.details },
  ]);
  readonly snapshotRunning = computed(
    () => this.snapshots()?.items.some((row) => row.status === 'RUNNING') ?? false,
  );
  readonly startingSnapshot = signal(false);
  readonly snapshotConfirmation = signal('');
  readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'erm-snapshot-confirm-message'),
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
    { id: 'time', label: this.text().time, width: '12rem', kind: 'date' },
    { id: 'severity', label: this.text().severity, width: '9rem', kind: 'status' },
    { id: 'status', label: this.text().status, width: '11rem', kind: 'status' },
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
      this.problemsLoading.set(true);
      const sub = this.api
        .watchDeviceProblems(this.recordId(), (this.problemPage() - 1) * 20)
        .valueChanges.subscribe({
          next: (result) => {
            this.problemsLoading.set(result.loading);
            this.problemsError.set(result.error ?? null);
            if (result.dataState === 'complete' && !result.error) {
              this.problems.set(result.data.fleetProblems);
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
      const cursor = this.cursor();
      const category = this.category();
      if (tab !== 'events' && tab !== 'frames' && tab !== 'parameters') {
        return;
      }
      this.historyLoading.set(true);
      this.historyError.set(null);
      const page = { pageSize: 50, cursor };
      const read: Observable<HistoryRead> =
        tab === 'events'
          ? this.api
              .watchEvents({
                id,
                language: ermLanguage(this.language()),
                input: { ...page, ...(category ? { categories: [category] } : {}) },
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
            ? this.api.watchFrames({ id, input: page }).valueChanges.pipe(
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
                  { id, input: { pageSize: 25, cursor } },
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
          }
          if (result.data && 'frames' in result.data) {
            this.frames.set(result.data.frames);
          }
          if (result.data && 'snapshots' in result.data) {
            this.snapshots.set(result.data.snapshots);
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
  record(id: string, label: string): ListRecord<'details'> {
    return { id, label, unavailable: [] };
  }
  selectCategory(value: ErmEventCategory | null): void {
    this.category.set(value);
    this.cursors.set([null]);
  }
  pageHistory(direction: 'previous' | 'next'): void {
    if (direction === 'previous') {
      this.cursors.update((cursors) => cursors.slice(0, -1));
    } else {
      const next = this.history()?.nextCursor;
      if (next) {
        this.cursors.update((cursors) => [...cursors, next]);
      }
    }
  }
  openDetail(id: string | undefined): void {
    if (this.tab() === 'events') {
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
    const text = this.text();
    this.snapshotConfirmation.set(
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
          detail: requestError(error, text.snapshots.startFailed),
        });
      }
    } finally {
      if (this.alive()) {
        this.startingSnapshot.set(false);
        this.refresh();
      }
    }
  }
}
