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
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
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
  ErmCommandState,
  ErmDeviceAction,
  ErmEventCategory,
  ErmEventSeverity,
  ErmFrameChecksum,
  ErmFrameDirection,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { formatDateTime, formatNumber, emptyValue } from '../../ui/format/format';
import { interpolate, uiMessages } from '../../ui/i18n/messages';
import { mapCoordinates } from '../../ui/map-preview/location-map';
import { MapPreview } from '../../ui/map-preview/map-preview';
import { PageHeader } from '../../ui/page-header/page-header';
import { TablePanel } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { deviceModelLabel } from '../fleet/devices/i18n/messages';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText, deviceLabel, ermLanguage, severityTone } from './control-center-text';

export type DeviceTab = 'overview' | 'events' | 'alarms' | 'commands' | 'frames';
type Device = AdminControlCenterDeviceQuery['fleetDevice'];
type Events = AdminControlCenterEventsQuery['fleetDevice']['ermEvents'];
type Commands = AdminControlCenterCommandsQuery['fleetDevice']['ermCommands'];
type Frames = AdminControlCenterFramesQuery['fleetDevice']['ermFrames'];
interface HistoryRead {
  readonly loading: boolean;
  readonly error: unknown;
  readonly data:
    | { readonly events: Events }
    | { readonly commands: Commands }
    | { readonly frames: Frames }
    | null;
}

export const ermDeviceActions: readonly ErmDeviceAction[] = [
  'REQUEST_LOCATION',
  'READ_STATUS',
  'READ_VERSION',
  'READ_ACCESSORIES',
  'READ_EDATA_DIAGNOSTICS',
  'READ_EDATA_FAULTS',
];
export const deviceTabs: readonly DeviceTab[] = [
  'overview',
  'events',
  'alarms',
  'commands',
  'frames',
];
const categories: readonly ErmEventCategory[] = ['POSITION', 'STATUS', 'ALARM', 'EDATA', 'OTHER'];
/** The Alarms tab matches the dashboard's ALARM count. */
const alarmCategories: ErmEventCategory[] = ['ALARM'];

/** A timeout or unavailable service after the request left: the unit may have received the frame. */
function unconfirmed(error: unknown): boolean {
  return (
    (ServerError.is(error) && (error.statusCode === 503 || error.statusCode === 504)) ||
    (CombinedGraphQLErrors.is(error) &&
      error.errors.some((failure) => failure.extensions?.['code'] === 'SERVICE_UNAVAILABLE'))
  );
}

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
  readonly actions = ermDeviceActions;
  readonly categories = categories;
  readonly toneSeverity = toneSeverity;
  readonly severityTone = severityTone;
  readonly confirmPt = computed(() => confirmDialogPt(this.language()));
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
  readonly historyLoading = signal(false);
  readonly historyError = signal<unknown>(null);
  readonly historyFailure = computed(() =>
    requestError(this.historyError(), this.text().unavailable),
  );
  private readonly historyReload = signal(0);
  readonly sending = signal<ErmDeviceAction | null>(null);
  readonly history = computed(() => {
    const tab = this.tab();
    return tab === 'events' || tab === 'alarms'
      ? this.events()
      : tab === 'commands'
        ? this.commands()
        : tab === 'frames'
          ? this.frames()
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
        this.historyError.set(null);
        this.historyLoading.set(tab !== 'overview');
      });
      if (tab === 'overview') {
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
  voltage(value: number | null): string {
    return value === null
      ? emptyValue
      : `${this.number(value, 2)}\u00a0${this.uiText().units.volt}`;
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

  async send(action: ErmDeviceAction): Promise<void> {
    const text = this.text();
    const unit = this.unitName();
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: text.confirmHeader,
      message: interpolate(text.confirmMessage, { action: text.actions[action], unit }),
      acceptLabel: text.send,
      danger: false,
    });
    if (!accepted) {
      return;
    }
    this.sending.set(action);
    try {
      const command = await this.api.sendCommand(this.recordId(), action);
      this.notifications.add({
        severity:
          command.status === 'ANSWERED'
            ? 'success'
            : command.status === 'SENT'
              ? 'info'
              : command.status === 'TIMEOUT'
                ? 'warn'
                : 'error',
        summary: text.commandResults[command.status],
        detail: `${text.actions[action]} · ${unit} · ${text.reference} ${command.reference}`,
      });
    } catch (error: unknown) {
      this.notifications.add(
        unconfirmed(error)
          ? { severity: 'warn', summary: text.commandUnconfirmed, detail: text.checkHistory }
          : {
              severity: 'error',
              summary: text.commandFailed,
              detail: requestError(error, text.commandFailed),
            },
      );
    } finally {
      this.sending.set(null);
      this.historyReload.update((value) => value + 1);
    }
  }
}
