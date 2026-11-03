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
import { KpiStrip } from '../../ui/kpi/kpi-strip';
import { KpiTile } from '../../ui/kpi/kpi-tile';
import { mapCoordinates } from '../../ui/map-preview/location-map';
import { MapPreview } from '../../ui/map-preview/map-preview';
import { PageHeader } from '../../ui/page-header/page-header';
import { TablePanel } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { deviceModelLabel } from '../fleet/devices/i18n/messages';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText, deviceLabel, ermLanguage, severityTone } from './control-center-text';

type Device = AdminControlCenterDevicesQuery['fleetDevices']['items'][number];

@Component({
  selector: 'holita-control-center-dashboard',
  imports: [
    RouterLink,
    ButtonDirective,
    TableModule,
    Tag,
    EmptyState,
    KpiStrip,
    KpiTile,
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
  readonly toneSeverity = toneSeverity;
  readonly severityTone = severityTone;
  readonly label = deviceLabel;

  readonly counts = computed(() => {
    const devices = this.devices();
    if (!devices) {
      return null;
    }
    return {
      units: this.total() ?? devices.length,
      online: devices.filter((device) => device.ermState?.online === true).length,
      offline: devices.filter((device) => device.ermState?.online === false).length,
      neverConnected: devices.filter((device) => !device.ermState).length,
      alarms: devices.filter((device) => (device.ermState?.alarmsLast24h ?? 0) > 0).length,
    };
  });
  /** Set when the Branch has more Devices than the dashboard reads. */
  readonly partial = computed(() => {
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
      rows: this.devices()?.length ?? null,
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
    (this.devices() ?? [])
      .filter(
        (device) =>
          device.ermState && (!device.ermState.online || device.ermState.alarmsLast24h > 0),
      )
      .map((device) => ({
        device,
        time: device.ermState?.latestAlarm?.eventTime ?? device.ermState?.lastFrameAt ?? null,
      }))
      .sort((left, right) => (right.time ?? '').localeCompare(left.time ?? '')),
  );
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
            if (result.dataState === 'complete' && !result.error) {
              this.devices.set(result.data.fleetDevices.items);
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
  count(value: number | undefined): string | null {
    return value === undefined ? null : this.number(value);
  }
  refresh(): void {
    this.reload.update((value) => value + 1);
  }
}
