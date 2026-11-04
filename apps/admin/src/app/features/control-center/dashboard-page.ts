import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { AdminControlCenterDevicesQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { formatDateTime, formatNumber } from '../../ui/format/format';
import { interpolate } from '../../ui/i18n/messages';
import { FleetConnection } from '../../ui/fleet-live/fleet-connection';
import { FleetNow } from '../../ui/fleet-live/fleet-now';
import { FleetLastReport } from '../../ui/fleet-live/fleet-last-report';
import { FleetFaults } from '../../ui/fleet-live/fleet-faults';
import { FleetLiveSummary } from '../../ui/fleet-live/fleet-live-summary';
import { fleetLiveText, type FleetLiveDevice } from '../../ui/fleet-live/fleet-live';
import { mapCoordinates } from '../../ui/map-preview/location-map';
import { MapPreview } from '../../ui/map-preview/map-preview';
import { PageHeader } from '../../ui/page-header/page-header';
import { TablePanel } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { deviceModelLabel } from '../fleet/devices/i18n/messages';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText, deviceLabel, ermLanguage, severityTone } from './control-center-text';

type Device = AdminControlCenterDevicesQuery['fleetDevices']['items'][number];
type Vehicle = AdminControlCenterDevicesQuery['fleetVehicles']['items'][number];
interface DashboardUnit {
  readonly id: string;
  readonly vehicleId: string | null;
  readonly plate: string | null;
  readonly devices: readonly Device[];
}

@Component({
  selector: 'holita-control-center-dashboard',
  imports: [
    RouterLink,
    ButtonDirective,
    TableModule,
    Tag,
    EmptyState,
    FleetConnection,
    FleetNow,
    FleetLastReport,
    FleetFaults,
    FleetLiveSummary,
    MapPreview,
    PageHeader,
    TablePanel,
  ],
  providers: [ControlCenterApi],
  templateUrl: './dashboard-page.html',
  styleUrl: './control-center.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  readonly text = computed(() => controlCenterText[this.language()]);

  protected modelLabel(model: string | null | undefined): string {
    return deviceModelLabel(this.language(), model);
  }
  private readonly api = inject(ControlCenterApi);
  private readonly units = injectFleetFormat();
  readonly devices = signal<Device[] | null>(null);
  readonly vehicles = signal<Vehicle[] | null>(null);
  readonly vehicleTotal = signal<number | null>(null);
  /** All Devices of the Branch; the dashboard reads only the first page. */
  readonly total = signal<number | null>(null);
  /** When the shown devices were read; a failed poll keeps them. */
  readonly updatedAt = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  /** The failure, with the time of the data still shown. */
  readonly failure = computed(() => {
    const failure = requestError(this.error(), this.text().unavailable);
    const updatedAt = this.updatedAt();
    return updatedAt
      ? `${failure} ${interpolate(this.text().lastUpdated, { time: this.date(updatedAt) })}`
      : failure;
  });
  private readonly reload = signal(0);
  readonly selectedId = signal<string | null>(null);
  readonly label = deviceLabel;
  readonly severityTone = severityTone;

  readonly liveText = computed(() => fleetLiveText(this.language()));
  liveDevice(device: Device): FleetLiveDevice {
    return this.error() && !device.ermState ? undefined : device;
  }
  diagnosticsLink(device: Device): string[] {
    return [...this.deviceLink(device), 'alarms'];
  }
  readonly rows = computed<DashboardUnit[]>(() => [
    ...(this.vehicles() ?? []).map((vehicle) => ({
      id: vehicle.id,
      vehicleId: vehicle.id,
      plate: vehicle.licensePlate,
      devices: vehicle.devices,
    })),
    ...(this.devices() ?? [])
      .filter((device) => !device.vehicleId)
      .map((device) => ({ id: device.id, vehicleId: null, plate: null, devices: [device] })),
  ]);
  readonly liveGroups = computed(() =>
    (this.vehicles() ?? []).map((vehicle) =>
      vehicle.devices.map((device) => this.liveDevice(device)),
    ),
  );
  unitDevices(unit: DashboardUnit): readonly FleetLiveDevice[] {
    return unit.devices.length ? unit.devices.map((device) => this.liveDevice(device)) : [null];
  }
  vehicleLink(id: string): string[] {
    return ['/', this.language(), this.branchId(), 'fleet', 'vehicles', id, 'overview'];
  }
  /** Set when the Branch has more Devices than the dashboard reads. */
  readonly partial = computed(() => {
    const vehicles = this.vehicles()?.length ?? 0;
    if ((this.vehicleTotal() ?? 0) > vehicles) {
      return interpolate(this.text().firstVehicles, {
        shown: this.number(vehicles),
        total: this.number(this.vehicleTotal()),
      });
    }
    const shown = this.devices()?.length ?? 0;
    const total = this.total() ?? 0;
    return total > shown
      ? interpolate(this.text().firstDevices, {
          shown: this.number(shown),
          total: this.number(total),
        })
      : null;
  });
  readonly view = computed(() =>
    tableView({
      loading: this.loading() && !this.devices(),
      error: this.error(),
      rows: this.vehicles() ? this.rows().length : null,
      filtered: false,
    }),
  );
  readonly positioned = computed(() =>
    (this.devices() ?? []).flatMap((device) => {
      const position = device.ermState?.lastPosition;
      const coordinates = mapCoordinates(position?.latitude, position?.longitude);
      return position && coordinates ? [{ device, position, coordinates }] : [];
    }),
  );
  readonly selected = computed(
    () =>
      this.positioned().find((item) => item.device.id === this.selectedId()) ??
      this.positioned()[0] ??
      null,
  );
  readonly attention = computed(() =>
    (this.vehicles() ?? []).flatMap((vehicle) => {
      const affected = vehicle.devices.flatMap((device) => {
        const reasons = this.attentionReasons(device);
        return reasons.length ? [{ device, reasons }] : [];
      });
      const first = affected[0];
      return first
        ? [
            {
              vehicle,
              device: first.device,
              reason: [...new Set(affected.flatMap((item) => item.reasons))].join(' · '),
            },
          ]
        : [];
    }),
  );
  private attentionReasons(device: Device): string[] {
    const state = device.ermState;
    const text = this.text().attentionReasons;
    return [
      ...(state?.health.overdue ? [text.overdue] : []),
      ...(device.routing === 'KARMA_BACKUP' ? [text.backup] : []),
      ...(!this.error() && (!state || (!state.online && !state.lastFrameAt)) ? [text.never] : []),
      ...(device.diagnostics.count > 0 ? [text.recordedFaults] : []),
      ...(state && state.alarmsLast24h > 0 && state.latestAlarm?.severity === 'CRITICAL'
        ? [text.criticalAlarm]
        : []),
    ];
  }
  readonly alarms = computed(() =>
    (this.devices() ?? [])
      .flatMap((device) =>
        device.ermState?.latestAlarm ? [{ device, alarm: device.ermState.latestAlarm }] : [],
      )
      .sort((left, right) =>
        (right.alarm.eventTime ?? '').localeCompare(left.alarm.eventTime ?? ''),
      ),
  );

  constructor() {
    effect((onCleanup) => {
      this.reload();
      this.loading.set(true);
      this.error.set(null);
      const subscription = this.api
        .watchDevices(ermLanguage(this.language()))
        .valueChanges.subscribe({
          next: (result) => {
            this.loading.set(result.loading);
            // A failed poll re-emits the previous data with the error; both stay visible.
            this.error.set(result.error ?? null);
            if (result.dataState === 'complete') {
              this.devices.set([
                ...new Map(
                  [
                    ...result.data.fleetDevices.items,
                    ...result.data.fleetVehicles.items.flatMap((vehicle) => vehicle.devices),
                  ].map((device) => [device.id, device]),
                ).values(),
              ]);
              this.vehicles.set(result.data.fleetVehicles.items);
              this.vehicleTotal.set(result.data.fleetVehicles.total);
              this.total.set(result.data.fleetDevices.total);
              this.updatedAt.set(new Date().toISOString());
            }
          },
          error: (error: unknown) => {
            this.loading.set(false);
            this.error.set(error);
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

  deviceLink(device: Device): string[] {
    return ['/', this.language(), this.branchId(), 'control-center', 'devices', device.id];
  }
  date(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), this.units.preferences().timeZone, true);
  }
  number(value: number | null | undefined, fraction = 0): string {
    return formatNumber(value, this.language(), { fraction });
  }
  refresh(): void {
    this.reload.update((value) => value + 1);
  }
}
