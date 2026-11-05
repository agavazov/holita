import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  type OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { map, type Observable } from 'rxjs';
import type {
  AdminControlCenterDeviceQuery,
  AdminControlCenterEventsQuery,
  AdminControlCenterCommandsQuery,
  AdminControlCenterFramesQuery,
  AdminControlCenterSnapshotsQuery,
  ErmCommandState,
  ErmEventCategory,
  ErmEventSeverity,
  ErmFrameChecksum,
  ErmFrameDirection,
  ErmParameterSnapshotStatus,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { injectPageRecord } from '../../layout/page-record';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { FleetConnection } from '../../ui/fleet-live/fleet-connection';
import { fleetCloseReason } from '../../ui/fleet-live/fleet-live';
import { FleetNow } from '../../ui/fleet-live/fleet-now';
import { FleetLastReport } from '../../ui/fleet-live/fleet-last-report';
import { FleetFaults } from '../../ui/fleet-live/fleet-faults';
import { formatDateTime, formatDuration, formatNumber, emptyValue } from '../../ui/format/format';
import { interpolate, uiMessages } from '../../ui/i18n/messages';
import { mapCoordinates } from '../../ui/map-preview/location-map';
import { MapPreview } from '../../ui/map-preview/map-preview';
import { PageHeader } from '../../ui/page-header/page-header';
import { TablePanel } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { deviceModelLabel } from '../fleet/devices/i18n/messages';
import { ControlCenterApi } from './control-center-api';
import { SmsPage } from './sms-page';
import { DeviceSettings } from './device-settings';
import { DeviceCommandQueue } from './device-command-queue';
import {
  controlCenterText,
  deviceLabel,
  ermLanguage,
  karmaByImei,
  severityTone,
} from './control-center-text';

export type DeviceTab =
  'overview' | 'events' | 'alarms' | 'commands' | 'parameters' | 'frames' | 'sms';
type Device = AdminControlCenterDeviceQuery['fleetDevice'];
type KarmaTruck = AdminControlCenterDeviceQuery['fleetKarmaMonitoringTrucks']['items'][number];
type Events = AdminControlCenterEventsQuery['fleetDevice']['ermEvents'];
type Commands = AdminControlCenterCommandsQuery['fleetDevice']['ermCommands'];
type Frames = AdminControlCenterFramesQuery['fleetDevice']['ermFrames'];
type Snapshots = AdminControlCenterSnapshotsQuery['fleetDevice']['ermParameterSnapshots'];
interface HistoryRead {
  readonly loading: boolean;
  readonly error: unknown;
  readonly data:
    | { readonly events: Events }
    | { readonly commands: Commands }
    | { readonly frames: Frames }
    | { readonly snapshots: Snapshots }
    | null;
}

export const deviceTabs: readonly DeviceTab[] = [
  'overview',
  'events',
  'alarms',
  'commands',
  'parameters',
  'frames',
  'sms',
];
const categories: readonly ErmEventCategory[] = ['POSITION', 'STATUS', 'ALARM', 'EDATA', 'OTHER'];
/** Fault evidence includes alarm events and decoded eData reports, including cleared faults. */
const alarmCategories: ErmEventCategory[] = ['ALARM', 'EDATA'];

@Component({
  selector: 'holita-control-center-device',
  imports: [
    JsonPipe,
    RouterLink,
    ButtonDirective,
    ConfirmDialog,
    Message,
    Skeleton,
    TableModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    EmptyState,
    MapPreview,
    PageHeader,
    TablePanel,
    FleetConnection,
    FleetNow,
    FleetLastReport,
    FleetFaults,
    SmsPage,
    DeviceSettings,
    DeviceCommandQueue,
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

  protected modelLabel(model: string | null | undefined): string {
    return deviceModelLabel(this.language(), model);
  }
  private readonly api = inject(ControlCenterApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notifications = inject(MessageService);
  private readonly units = injectFleetFormat();
  readonly tabs = deviceTabs;
  readonly categories = categories;
  readonly toneSeverity = toneSeverity;
  readonly severityTone = severityTone;
  readonly snapshotConfirmation = signal('');
  readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'erm-snapshot-confirm-message'),
  );
  readonly uiText = computed(() => uiMessages[this.language()]);

  readonly device = signal<Device | null>(null);
  /** When the shown device was read; a failed poll keeps it. */
  readonly deviceUpdatedAt = signal<string | null>(null);
  readonly deviceLoading = signal(true);
  readonly deviceError = signal<unknown>(null);
  readonly deviceFailure = computed(() =>
    requestError(this.deviceError(), this.text().deviceUnavailable),
  );
  readonly staleFailure = computed(() =>
    interpolate(this.text().staleDevice, {
      error: this.deviceFailure(),
      time: this.date(this.deviceUpdatedAt()),
    }),
  );
  private readonly deviceReload = signal(0);
  readonly state = computed(() => this.device()?.ermState ?? null);
  readonly liveDevice = computed(() =>
    this.deviceError() && !this.state() ? undefined : this.device(),
  );
  private readonly karmaTrucks = signal<ReadonlyMap<string, KarmaTruck>>(new Map());
  /** Fleet's Karma monitoring of this unit, for the Karma-versus-holita cross-check. */
  readonly karma = computed(() => {
    const imei = this.device()?.imei;
    return imei ? (this.karmaTrucks().get(imei) ?? null) : null;
  });
  /** Fleet's routing state explains where the unit's data arrives. */
  readonly routing = computed(() => this.device()?.routing ?? null);
  readonly karmaText = computed(() => {
    const karma = this.karma();
    const routing = this.routing();
    const lastData = karma
      ? interpolate(this.text().lastData, { time: this.date(karma.lastDataAt) })
      : this.text().notInKarma;
    return routing ? `${this.text().routing[routing]} · ${lastData}` : lastData;
  });
  readonly healthLine = computed(() => {
    const health = this.state()?.health;
    if (!health) {
      return emptyValue;
    }
    const gaps = health.gapsLast24h;
    const parts = [
      this.format(this.text().gaps24h, {
        count: gaps.length,
        duration: this.duration(gaps.reduce((total, gap) => total + gap.durationSeconds, 0)),
      }),
      this.format(this.text().networkChanges24h, { count: health.networkChangesLast24h }),
    ];
    const routing = this.device()?.routingHealth;
    if (routing) {
      parts.push(
        this.format(this.text().backupTime, { duration: this.duration(routing.backupSeconds) }),
      );
    }
    if (health.lastCloseReason) {
      parts.push(this.closeReason(health.lastCloseReason));
    }
    return parts.join(' · ');
  });
  readonly title = computed(() => {
    const device = this.device();
    return device ? deviceLabel(device) : this.text().units;
  });
  /** The truck and IMEI that a command goes to. */
  readonly unitName = computed(() => {
    const device = this.device();
    const imei = `${this.text().imei} ${device?.imei ?? emptyValue}`;
    return device?.vehicle ? `${device.vehicle.licensePlate} (${imei})` : imei;
  });
  /** holita sends commands only to units it serves as their primary server. */
  readonly canSend = computed(
    () => this.state()?.online === true && this.state()?.mode === 'PRIMARY',
  );
  readonly commandsHint = computed(() => {
    const state = this.state();
    return !state?.online
      ? this.text().commandsOffline
      : state.mode !== 'PRIMARY'
        ? this.text().commandsMirror
        : this.text().commandsHint;
  });
  readonly position = computed(() => {
    const event = this.state()?.lastPosition;
    const coordinates = mapCoordinates(event?.latitude, event?.longitude);
    return event && coordinates ? { event, coordinates } : null;
  });

  readonly category = linkedSignal<DeviceTab, ErmEventCategory | null>({
    source: this.tab,
    computation: () => null,
  });
  readonly cursor = linkedSignal<DeviceTab, string | null>({
    source: this.tab,
    computation: () => null,
  });
  readonly events = signal<Events | null>(null);
  readonly commands = signal<Commands | null>(null);
  readonly frames = signal<Frames | null>(null);
  readonly snapshots = signal<Snapshots | null>(null);
  /** The snapshots query polls only while one of them is still reading. */
  readonly snapshotRunning = computed(
    () => this.snapshots()?.items.some((snapshot) => snapshot.status === 'RUNNING') ?? false,
  );
  readonly selectedSnapshotId = linkedSignal<DeviceTab, string | null>({
    source: this.tab,
    computation: () => null,
  });
  /** The chosen snapshot, else the newest one. */
  readonly selectedSnapshot = computed(() => {
    const items = this.snapshots()?.items ?? [];
    return items.find((snapshot) => snapshot.id === this.selectedSnapshotId()) ?? items[0] ?? null;
  });
  readonly startingSnapshot = signal(false);
  readonly historyLoading = signal(false);
  readonly historyError = signal<unknown>(null);
  readonly historyFailure = computed(() =>
    requestError(this.historyError(), this.text().unavailable),
  );
  private readonly historyReload = signal(0);
  readonly history = computed(() => {
    const tab = this.tab();
    return tab === 'events' || tab === 'alarms'
      ? this.events()
      : tab === 'commands'
        ? this.commands()
        : tab === 'frames'
          ? this.frames()
          : tab === 'parameters'
            ? this.snapshots()
            : null;
  });
  readonly historyView = computed(() =>
    tableView({
      loading: this.historyLoading() && !this.history(),
      error: this.historyError(),
      rows: this.history()?.items.length ?? null,
      filtered: this.category() !== null,
    }),
  );

  constructor() {
    injectPageRecord(() => (this.device() ? this.title() : null));
    effect((onCleanup) => {
      this.deviceReload();
      const id = this.recordId();
      const language = ermLanguage(this.language());
      this.deviceLoading.set(true);
      this.deviceError.set(null);
      const subscription = this.api.watchDevice(id, language).valueChanges.subscribe({
        next: (result) => {
          this.deviceLoading.set(result.loading);
          // A failed poll re-emits the previous data with the error; both stay visible.
          this.deviceError.set(result.error ?? null);
          if (result.dataState === 'complete' && (!result.error || !this.device())) {
            this.device.set(result.data.fleetDevice);
            this.karmaTrucks.set(karmaByImei(result.data.fleetKarmaMonitoringTrucks));
            this.deviceUpdatedAt.set(new Date().toISOString());
          }
        },
        error: (error: unknown) => {
          this.deviceLoading.set(false);
          this.deviceError.set(error);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      this.historyReload();
      const tab = this.tab();
      const id = this.recordId();
      const language = ermLanguage(this.language());
      const cursor = this.cursor();
      const category = this.category();
      untracked(() => {
        this.events.set(null);
        this.commands.set(null);
        this.frames.set(null);
        this.snapshots.set(null);
        this.historyError.set(null);
        this.historyLoading.set(tab !== 'overview' && tab !== 'sms');
      });
      if (tab === 'overview' || tab === 'sms') {
        return;
      }
      const page = { pageSize: 50, cursor };
      const read: Observable<HistoryRead> =
        tab === 'events' || tab === 'alarms'
          ? this.api
              .watchEvents({
                id,
                language,
                input: {
                  ...page,
                  ...(tab === 'alarms'
                    ? { categories: alarmCategories }
                    : category
                      ? { categories: [category] }
                      : {}),
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
          : tab === 'commands'
            ? this.api.watchCommands({ id, input: page }).valueChanges.pipe(
                map((result) => ({
                  loading: result.loading,
                  error: result.error,
                  data:
                    result.dataState === 'complete' && !result.error
                      ? { commands: result.data.fleetDevice.ermCommands }
                      : null,
                })),
              )
            : tab === 'parameters'
              ? this.api
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
                  )
              : this.api.watchFrames({ id, input: page }).valueChanges.pipe(
                  map((result) => ({
                    loading: result.loading,
                    error: result.error,
                    data:
                      result.dataState === 'complete' && !result.error
                        ? { frames: result.data.fleetDevice.ermFrames }
                        : null,
                  })),
                );
      const subscription = read.subscribe({
        next: (result) => {
          this.historyLoading.set(result.loading);
          this.historyError.set(result.error ?? null);
          if (result.data && 'events' in result.data) {
            this.events.set(result.data.events);
          }
          if (result.data && 'commands' in result.data) {
            this.commands.set(result.data.commands);
          }
          if (result.data && 'frames' in result.data) {
            this.frames.set(result.data.frames);
          }
          if (result.data && 'snapshots' in result.data) {
            this.snapshots.set(result.data.snapshots);
          }
        },
        error: (error: unknown) => {
          this.historyLoading.set(false);
          this.historyError.set(error);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
  }

  link(...path: string[]): string[] {
    return ['/', this.language(), this.branchId(), ...path];
  }
  deviceLink(tab: DeviceTab): string[] {
    return this.link('control-center', 'devices', this.recordId(), tab);
  }
  selectTab(value: string | number | undefined): void {
    const tab = deviceTabs.find((tab) => tab === value);
    if (tab) {
      void this.router.navigate(this.deviceLink(tab));
    }
  }
  refresh(): void {
    this.deviceReload.update((value) => value + 1);
    this.historyReload.update((value) => value + 1);
  }
  date(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.units.preferences().timeZone, true);
  }
  closeReason(value: string | null | undefined): string {
    return fleetCloseReason(value, this.language());
  }
  number(value: number | null | undefined, fraction = 1): string {
    return formatNumber(value, this.language(), { fraction });
  }
  /** Speed and odometer in the Branch's units; no unit next to an absent value. */
  speed(value: number | null): string {
    return this.units.speed(value);
  }
  distance(value: number | null): string {
    return this.units.distance(value, true, 0);
  }
  duration(seconds: number | null): string {
    return formatDuration(seconds, this.language());
  }
  /** A unit reading with the time it was observed. */
  reading(
    reading: { readonly value: number; readonly observedAt: string } | null,
    unit: 'volt' | null,
    fraction: number,
  ): string {
    if (!reading) {
      return emptyValue;
    }
    const value = this.number(reading.value, fraction);
    return `${unit ? `${value}\u00a0${this.uiText().units[unit]}` : value} · ${this.date(reading.observedAt)}`;
  }
  format(template: string, values: Readonly<Record<string, string | number>>): string {
    return interpolate(template, values);
  }
  voltage(value: number | null): string {
    return value === null
      ? emptyValue
      : `${this.number(value, 2)}\u00a0${this.uiText().units.volt}`;
  }
  /** Fault records (419) and the CAN error flag (411) of a decoded eData report. */
  edataSummary(value: unknown): string | null {
    if (typeof value !== 'object' || value === null || !('type' in value)) {
      return null;
    }
    const text = this.text();
    if (value.type === 419 && 'faults' in value && Array.isArray(value.faults)) {
      const faults: unknown[] = value.faults;
      const records = faults.flatMap((fault) =>
        typeof fault === 'object' &&
        fault !== null &&
        'spn' in fault &&
        typeof fault.spn === 'number' &&
        'fmi' in fault &&
        typeof fault.fmi === 'number'
          ? [
              `SPN ${String(fault.spn)} FMI ${String(fault.fmi)}${
                'status' in fault && fault.status === 2 ? ` (${text.faultCleared})` : ''
              }`,
            ]
          : [],
      );
      return records.length ? `${text.faults}: ${records.join(', ')}` : null;
    }
    return value.type === 411 &&
      'canError' in value &&
      typeof value.canError === 'number' &&
      value.canError !== 0
      ? text.edataCanError
      : null;
  }
  commandFields(fields: readonly string[]): string {
    return fields.length ? ` · ${fields.join(',')}` : '';
  }
  engine(value: boolean | null | undefined): string {
    return value === null || value === undefined
      ? emptyValue
      : value
        ? this.text().on
        : this.text().off;
  }
  mode(value: string | null | undefined): string {
    return value === 'MIRROR'
      ? this.text().mirror
      : value === 'PRIMARY'
        ? this.text().primary
        : emptyValue;
  }
  commandState(value: ErmCommandState): string {
    return this.text().commandStates[value];
  }
  direction(value: ErmFrameDirection): string {
    return this.text().directions[value];
  }
  checksum(value: ErmFrameChecksum): string {
    return this.text().checksums[value];
  }
  categoryLabel(value: ErmEventCategory): string {
    return this.text().categories[value];
  }
  severityLabel(value: ErmEventSeverity): string {
    return this.text().severities[value];
  }
  commandTone(value: ErmCommandState) {
    return toneSeverity(value === 'ANSWERED' ? 'success' : value === 'SENT' ? 'info' : 'warn');
  }

  snapshotStatus(value: ErmParameterSnapshotStatus): string {
    return this.text().snapshots.statuses[value];
  }
  snapshotTone(value: ErmParameterSnapshotStatus) {
    return toneSeverity(value === 'COMPLETE' ? 'success' : value === 'RUNNING' ? 'info' : 'danger');
  }
  /** StarLink parameters are numbered with four digits, for example 0593. */
  parameterNumber(value: number): string {
    return String(value).padStart(4, '0');
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
    if (!accepted) {
      return;
    }
    this.startingSnapshot.set(true);
    try {
      await this.api.startSnapshot(this.recordId());
      this.notifications.add({ severity: 'info', summary: text.snapshots.started });
    } catch (error: unknown) {
      this.notifications.add({
        severity: 'error',
        summary: text.snapshots.startFailed,
        detail: requestError(error, text.snapshots.startFailed),
      });
    } finally {
      this.startingSnapshot.set(false);
      this.historyReload.update((value) => value + 1);
    }
  }
}
