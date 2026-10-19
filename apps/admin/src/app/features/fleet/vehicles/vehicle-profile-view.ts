import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { ColumnSeries, type SeriesPoint } from '../../../ui/charts/column-series';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import {
  FormatDateOnlyPipe,
  FormatDateTimePipe,
  FormatDurationPipe,
  FormatMoneyPipe,
  FormatNumberPipe,
  FormatRelativePipe,
} from '../../../ui/format/format.pipes';
import { formatDateOnly, formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { PageHeader } from '../../../ui/page-header/page-header';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import {
  type AlertRow,
  type AlertSeverityCode,
  type AlertStatusCode,
  alertStatusTones,
  severityTones,
} from '../alerts/alerts-view';
import { alertsText } from '../alerts/i18n/messages';
import { scoreTone } from '../drivers/drivers-view';
import { maintenanceText } from '../maintenance/i18n/messages';
import { type ServiceTaskRow, urgencyTones, serviceStatusTones } from '../maintenance/service-task';
import { tripsText } from '../trips/i18n/messages';
import { type TripRow, worstTone } from '../trips/trips-view';
import { vehiclesText } from './i18n/messages';
import type { VehicleFuelType } from './vehicle-drawer';
import type { VehicleRow } from './vehicles-view';

/** The vehicle record of the profile page: the list row plus specification and live data. */
export interface VehicleProfile extends VehicleRow {
  readonly vin: string;
  readonly fuelType: VehicleFuelType | null;
  readonly tankL: number | null;
  readonly speedKph: number | null;
  readonly createdAt: string;
}

export type VehicleProfileState = 'loading' | 'ready' | 'not-found' | 'error';
export const vehicleProfileTabs = ['overview', 'trips', 'alerts', 'service'] as const;
export type VehicleProfileTab = (typeof vehicleProfileTabs)[number];

const statusTones = { ACTIVE: 'success', IN_WORKSHOP: 'warn', INACTIVE: 'neutral' } as const;

function listView(rows: readonly unknown[]): TableView {
  return { kind: rows.length ? 'rows' : 'empty' };
}

/**
 * The full-page record: header with Edit, KPIs and tabs (overview, trips, alerts, service).
 * Presentation only: the host loads the vehicle and its related lists, opens the drawers and
 * keeps the selected tab.
 */
@Component({
  selector: 'holita-vehicle-profile-view',
  imports: [
    RouterLink,
    ButtonDirective,
    TableModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    ColumnSeries,
    EmptyState,
    FormatDateOnlyPipe,
    FormatDateTimePipe,
    FormatDurationPipe,
    FormatMoneyPipe,
    FormatNumberPipe,
    FormatRelativePipe,
    KpiStrip,
    KpiTile,
    PageHeader,
    TablePanel,
  ],
  templateUrl: './vehicle-profile-view.html',
  styleUrl: './vehicle-profile-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class VehicleProfileView {
  readonly state = input.required<VehicleProfileState>();
  readonly vehicle = input<VehicleProfile | null>(null);
  readonly dataAsOf = input.required<string>();
  readonly backLink = input.required<readonly string[]>();
  readonly distance = input<readonly SeriesPoint[]>([]);
  readonly trips = input<readonly TripRow[]>([]);
  readonly alerts = input<readonly AlertRow[]>([]);
  readonly service = input<readonly ServiceTaskRow[]>([]);
  readonly tab = input<VehicleProfileTab>('overview');
  readonly tabChange = output<VehicleProfileTab>();
  readonly edit = output();
  readonly recordOdometer = output();
  readonly retry = output();
  readonly openTrip = output<string>();
  readonly openAlert = output<string>();
  readonly openService = output<string>();

  private readonly language = inject(UI_LANGUAGE);
  private readonly vehicles = computed(() => vehiclesText(this.language()));
  protected readonly text = computed(() => this.vehicles().profile);
  protected readonly staleFuelText = computed(() => this.vehicles().table.staleFuel);
  protected readonly tripText = computed(() => tripsText(this.language()).table);
  private readonly alertCatalog = computed(() => alertsText(this.language()));
  protected readonly alertCatalogTable = computed(() => this.alertCatalog().table);
  private readonly maintenance = computed(() => maintenanceText(this.language()));
  protected readonly serviceTable = computed(() => this.maintenance().table);

  protected readonly description = computed(() => {
    const vehicle = this.vehicle();
    if (!vehicle) return null;
    const type = vehicle.type ? this.vehicles().types[vehicle.type] : null;
    return [vehicle.fleetNumber, [vehicle.make, vehicle.model].filter(Boolean).join(' '), type]
      .filter(Boolean)
      .join(' · ');
  });
  protected readonly openAlerts = computed(
    () => this.alerts().filter((alert) => alert.status === 'OPEN').length,
  );
  protected readonly distanceTotal = computed(() => {
    const values = this.distance().flatMap((point) => (point.value === null ? [] : [point.value]));
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  });
  protected readonly nextService = computed(() => {
    const task = this.service().find((item) => item.status === 'PLANNED');
    if (!task) return { value: this.text().kpis.noService, footnote: null, tone: null };
    const due = task.dueOn ? formatDateOnly(task.dueOn, this.language()) : null;
    return {
      value: task.kind,
      footnote:
        due ?? (task.dueKm === null ? null : `${formatNumber(task.dueKm, this.language())} km`),
      tone:
        task.urgency === 'OVERDUE'
          ? ('danger' as const)
          : task.urgency === 'DUE_SOON'
            ? ('warn' as const)
            : null,
    };
  });
  protected readonly tripView = computed(() => listView(this.trips()));
  protected readonly alertView = computed(() => listView(this.alerts()));
  protected readonly serviceView = computed(() => listView(this.service()));
  /** PrimeNG's table takes mutable arrays. */
  protected readonly tripRows = computed(() => [...this.trips()]);
  protected readonly alertRows = computed(() => [...this.alerts()]);
  protected readonly serviceRows = computed(() => [...this.service()]);

  protected statusSeverity(status: keyof typeof statusTones) {
    return toneSeverity(statusTones[status]);
  }

  protected statusLabel(status: keyof typeof statusTones): string {
    return this.vehicles().statuses[status];
  }

  protected activityLabel(vehicle: VehicleProfile): string {
    return this.vehicles().activities[vehicle.activity];
  }

  protected fuelTypeLabel(vehicle: VehicleProfile): string {
    return vehicle.fuelType ? this.vehicles().fuelTypes[vehicle.fuelType] : '—';
  }

  protected selectTab(value: string | number | undefined): void {
    const tab = vehicleProfileTabs.find((item) => item === value);
    if (tab) this.tabChange.emit(tab);
  }

  protected scoreClass(score: number): string {
    return `app-meter app-meter--${scoreTone(score)}`;
  }

  protected eventsSeverity(trip: TripRow) {
    return toneSeverity(worstTone(trip.events));
  }

  protected eventsLabel(trip: TripRow): string {
    return interpolate(this.tripText().eventCount, { count: trip.events.length });
  }

  protected severitySeverity(severity: AlertSeverityCode) {
    return toneSeverity(severityTones[severity]);
  }

  protected severityLabel(severity: AlertSeverityCode): string {
    return this.alertCatalog().severities[severity];
  }

  protected alertStatusSeverity(status: AlertStatusCode) {
    return toneSeverity(alertStatusTones[status]);
  }

  protected alertStatusLabel(status: AlertStatusCode): string {
    return this.alertCatalog().statuses[status];
  }

  protected urgencySeverity(task: ServiceTaskRow) {
    return toneSeverity(
      task.urgency ? urgencyTones[task.urgency] : serviceStatusTones[task.status],
    );
  }

  protected urgencyLabel(task: ServiceTaskRow): string {
    return task.urgency
      ? this.maintenance().urgencies[task.urgency]
      : this.maintenance().statuses[task.status];
  }

  protected kmLeftLabel(task: ServiceTaskRow): string | null {
    if (task.kmLeft === null || task.status !== 'PLANNED') return null;
    const table = this.maintenance().table;
    const km = formatNumber(Math.abs(task.kmLeft), this.language());
    return interpolate(task.kmLeft < 0 ? table.kmOver : table.kmLeft, { km });
  }

  protected tripLabel(trip: TripRow): string {
    return `${trip.from ?? '—'} → ${trip.to ?? '—'}`;
  }
}
