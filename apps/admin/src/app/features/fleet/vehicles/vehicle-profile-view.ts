import type { FleetRecordLinks } from '../fleet-record-links';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { RouterLink, type Params } from '@angular/router';
import { ChartLine } from '@primeicons/angular/chart-line';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { Gauge } from '@primeicons/angular/gauge';
import { Wrench } from '@primeicons/angular/wrench';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Skeleton } from 'primeng/skeleton';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { ColumnSeries, type SeriesPoint } from '../../../ui/charts/column-series';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { FleetNow } from '../../../ui/fleet-live/fleet-now';
import { injectFleetNow } from '../../../ui/fleet-live/fleet-clock';
import { fleetObservationIsRecent, fleetRecordedValue } from '../../../ui/fleet-live/fleet-live';
import {
  FormatDurationPipe,
  FormatMoneyPipe,
  FormatNumberPipe,
  FormatRelativePipe,
} from '../../../ui/format/format.pipes';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { trackById } from '../../../ui/list/list-actions';
import {
  LocationMap,
  type LocationMapRecord,
  type LocationMapTrack,
} from '../../../ui/location-map/location-map';
import { PageHeader } from '../../../ui/page-header/page-header';
import { TablePanel, type TableColumn, type TablePage } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatNumber } from '../../../ui/format/format';
import { type AlertSeverityCode, severityTones } from '../alerts/alerts-view';
import { alertsText } from '../alerts/i18n/messages';
import { scoreTone } from '../drivers/drivers-view';
import { maintenanceText } from '../maintenance/i18n/messages';
import { type ServiceTaskRow, urgencyTones, serviceStatusTones } from '../maintenance/service-task';
import { tripsText } from '../trips/i18n/messages';
import { type TripRow, worstTone } from '../trips/trips-view';
import { VehicleCommandHistory } from '../commands/vehicle-command-history';
import { vehiclesText } from './i18n/messages';
import type { VehicleFuelType } from './vehicle-drawer';
import { vehicleLastReport, vehicleLiveDevice, vehicleLiveStatus } from './vehicle-live';
import type { VehicleProblem, VehicleProblemCounts } from './vehicle-profile-v2-model';
import type { VehicleRow } from './vehicles-view';
import bg from './vehicle-profile-view.bg.json';
import en from './vehicle-profile-view.en.json';

/** The vehicle record of the profile page: the list row plus specification and live data. */
export interface VehicleProfile extends VehicleRow {
  readonly currentDriverId: string | null;
  readonly vin: string;
  readonly fuelType: VehicleFuelType | null;
  readonly tankL: number | null;
  readonly speedKph: number | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly headingDeg: number | null;
  readonly createdAt: string;
}

/** Counts of unverified raw observations, without assigning physical meaning to their values. */
export interface EdataObservation {
  readonly id: number;
  readonly label: string;
  readonly count: number;
  readonly lastAt: string;
}

export type VehicleProfileState = 'loading' | 'ready' | 'not-found' | 'error';
export const vehicleProfileTabs = [
  'overview',
  'problems',
  'trips',
  'maintenance',
  'commands',
] as const;
export type VehicleProfileTab = (typeof vehicleProfileTabs)[number];

const statusTones = { ACTIVE: 'success', IN_WORKSHOP: 'warn', INACTIVE: 'neutral' } as const;
const problemStateTones = {
  OPEN: 'danger',
  ACKNOWLEDGED: 'warn',
  RECORDED: 'neutral',
  FAILED: 'danger',
  UNCERTAIN: 'warn',
  EXPIRED: 'neutral',
} as const;

function listView(rows: readonly unknown[]): TableView {
  return { kind: rows.length ? 'rows' : 'empty' };
}

/** Vehicle record presentation. The routed adapter owns fetching, paging and business drawers. */
@Component({
  selector: 'holita-vehicle-profile-view',
  imports: [
    RouterLink,
    ChartLine,
    ExclamationTriangle,
    Gauge,
    Wrench,
    ButtonDirective,
    TableModule,
    Skeleton,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    ColumnSeries,
    EmptyState,
    FleetNow,
    FormatDurationPipe,
    FormatMoneyPipe,
    FormatNumberPipe,
    FormatRelativePipe,
    KpiStrip,
    KpiTile,
    LocationMap,
    PageHeader,
    TablePanel,
    VehicleCommandHistory,
  ],
  templateUrl: './vehicle-profile-view.html',
  styleUrl: './vehicle-profile-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class VehicleProfileView {
  readonly branchId = input.required<string>();
  readonly deviceLinkBase = input<readonly string[]>([]);
  readonly recordLinks = input<FleetRecordLinks | null>(null);
  readonly state = input.required<VehicleProfileState>();
  readonly vehicle = input<VehicleProfile | null>(null);
  readonly dataAsOf = input.required<string>();
  readonly backLink = input.required<readonly string[]>();
  readonly backQueryParams = input<Params | null>(null);
  readonly backFragment = input<string | null>(null);
  readonly backLabel = input<string | null>(null);
  readonly errorText = input<string | null>(null);
  readonly distance = input<readonly SeriesPoint[]>([]);
  readonly mapRecords = input<readonly LocationMapRecord[]>([]);
  readonly mapAsOf = input<string | null>(null);
  readonly mapUpdatedAt = input<string | null>(null);
  readonly mapDataAsOf = input<string | null>(null);
  readonly mapSpeedKph = input<number | null>(null);
  readonly track = input<LocationMapTrack | null>(null);
  readonly trackLoading = input(false);
  readonly trackError = input<string | null>(null);
  readonly retryTrack = output();
  readonly edataObservations = input<readonly EdataObservation[]>([]);
  readonly edataFrom = input('');
  readonly edataTo = input('');
  readonly edataLoading = input(false);
  readonly edataError = input<string | null>(null);
  readonly edataTruncated = input(false);
  readonly retryEdata = output();
  readonly trips = input<readonly TripRow[]>([]);
  readonly problems = input<readonly VehicleProblem[]>([]);
  readonly problemCounts = input<VehicleProblemCounts | null>(null);
  readonly service = input<readonly ServiceTaskRow[]>([]);
  readonly nextServiceTask = input<ServiceTaskRow | null | undefined>(undefined);
  readonly tripPage = input<TablePage | null>(null);
  readonly problemPage = input<TablePage | null>(null);
  readonly servicePage = input<TablePage | null>(null);
  readonly tripState = input<TableView | null>(null);
  readonly problemState = input<TableView | null>(null);
  readonly serviceState = input<TableView | null>(null);
  readonly tripError = input<string | null>(null);
  readonly problemError = input<string | null>(null);
  readonly serviceError = input<string | null>(null);
  readonly tripPageChange = output<{ page: number; pageSize: number }>();
  readonly problemPageChange = output<{ page: number; pageSize: number }>();
  readonly servicePageChange = output<{ page: number; pageSize: number }>();
  readonly retryTrips = output();
  readonly retryProblems = output();
  readonly retryService = output();
  readonly tab = input<VehicleProfileTab>('overview');
  readonly tabChange = output<VehicleProfileTab>();
  readonly edit = output();
  readonly recordOdometer = output();
  readonly retry = output();
  readonly openTrip = output<string>();
  readonly openAlert = output<string>();
  readonly openService = output<string>();

  protected readonly units = injectFleetFormat();
  protected readonly now = injectFleetNow();
  protected readonly language = inject(UI_LANGUAGE);
  private readonly vehicles = computed(() => vehiclesText(this.language()));
  protected readonly text = computed(() => this.vehicles().profile);
  protected readonly v2 = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly staleFuelText = computed(() => this.vehicles().table.staleFuel);
  protected readonly tripText = computed(() => {
    const table = tripsText(this.language()).table;
    return { ...table, distance: interpolate(table.distance, { unit: this.units.distanceUnit() }) };
  });
  private readonly alertCatalog = computed(() => alertsText(this.language()));
  private readonly maintenance = computed(() => maintenanceText(this.language()));
  protected readonly serviceTable = computed(() => this.maintenance().table);
  protected readonly profileTabs = vehicleProfileTabs;
  protected readonly trackById = trackById;
  protected readonly toneSeverity = toneSeverity;
  protected readonly description = computed(() => {
    const vehicle = this.vehicle();
    if (!vehicle) {
      return null;
    }
    const type = vehicle.type ? this.vehicles().types[vehicle.type] : null;
    return [vehicle.fleetNumber, [vehicle.make, vehicle.model].filter(Boolean).join(' '), type]
      .filter(Boolean)
      .join(' · ');
  });
  protected readonly liveDevices = computed(
    () => this.vehicle()?.liveDevices ?? this.vehicle()?.devices.map(() => undefined) ?? [],
  );
  protected readonly activityDevice = computed(() => vehicleLiveDevice(this.liveDevices()));
  protected readonly liveStatus = computed(() =>
    vehicleLiveStatus(this.liveDevices(), this.language()),
  );
  protected readonly lastReport = computed(
    () => vehicleLastReport(this.liveDevices()) ?? this.vehicle()?.lastReportedAt ?? null,
  );
  protected readonly positionAt = computed(() => this.mapRecords()[0]?.positionAt ?? null);
  private readonly positionIsRecent = computed(() =>
    fleetObservationIsRecent(
      this.positionAt(),
      this.now(),
      this.units.preferences().notReportingHours,
    ),
  );
  protected readonly speedText = computed(() => {
    const speed = this.mapSpeedKph();
    return this.positionIsRecent() && speed !== null
      ? fleetRecordedValue(this.units.speed(speed), this.positionAt(), this.now(), this.language())
      : '—';
  });
  protected readonly headingText = computed(() => {
    const heading = this.mapRecords()[0]?.heading;
    return this.positionIsRecent() && heading !== null && heading !== undefined
      ? fleetRecordedValue(
          `${formatNumber(heading, this.language())}°`,
          this.positionAt(),
          this.now(),
          this.language(),
        )
      : '—';
  });
  protected readonly locationText = computed(() => {
    const vehicle = this.vehicle();
    return vehicle?.location
      ? fleetRecordedValue(vehicle.location, vehicle.lastReportedAt, this.now(), this.language())
      : '—';
  });
  protected readonly problemSummary = computed(() => {
    const counts = this.problemCounts();
    return counts
      ? interpolate(this.v2().problemSummary, {
          attention: counts.requiringAttention,
          recorded: counts.recorded,
        })
      : this.v2().viewProblems;
  });
  protected readonly distanceTotal = computed(() => {
    const values = this.distance().flatMap((point) => (point.value === null ? [] : [point.value]));
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  });
  protected readonly distancePoints = computed(() =>
    this.distance().map((point) => ({
      ...point,
      value: this.units.distanceValue(point.value),
      valueText: this.units.distance(point.value, true, 0),
    })),
  );
  protected readonly nextService = computed(() => {
    const task =
      this.nextServiceTask() === undefined
        ? this.service().find((item) => item.status === 'PLANNED')
        : this.nextServiceTask();
    if (!task) {
      return { value: this.text().kpis.noService, footnote: null, tone: null };
    }
    return {
      value: task.kind,
      footnote: task.dueOn
        ? this.units.dateOnly(task.dueOn)
        : task.dueKm === null
          ? null
          : this.units.distance(task.dueKm, true, 0),
      tone:
        task.urgency === 'OVERDUE'
          ? ('danger' as const)
          : task.urgency === 'DUE_SOON'
            ? ('warn' as const)
            : null,
    };
  });
  protected readonly tripView = computed(() => this.tripState() ?? listView(this.trips()));
  protected readonly problemView = computed(() => this.problemState() ?? listView(this.problems()));
  protected readonly serviceView = computed(() => this.serviceState() ?? listView(this.service()));
  protected readonly edataView = computed<TableView>(() =>
    this.edataLoading()
      ? { kind: 'loading' }
      : this.edataError()
        ? { kind: 'error' }
        : listView(this.edataObservations()),
  );
  protected readonly tripRows = computed(() => [...this.trips()]);
  protected readonly problemRows = computed(() => [...this.problems()]);
  protected readonly serviceRows = computed(() => [...this.service()]);
  protected readonly edataRows = computed(() => [...this.edataObservations()]);
  protected readonly selectedDeviceId = linkedSignal<VehicleProfile | null, string>({
    source: this.vehicle,
    computation: (vehicle, previous) =>
      previous &&
      vehicle &&
      vehicle.id === previous.source?.id &&
      vehicle.devices.some((device) => device.id === previous.value)
        ? previous.value
        : '',
  });
  protected readonly selectedDevice = computed(() =>
    this.vehicle()?.devices.find((device) => device.id === this.selectedDeviceId()),
  );
  protected readonly tripColumns = computed<readonly TableColumn[]>(() => [
    { id: 'started', label: this.tripText().started, width: '12rem', kind: 'date' },
    { id: 'route', label: this.tripText().route, width: '19rem', kind: 'identity' },
    { id: 'distance', label: this.tripText().distance, width: '8rem', kind: 'number' },
    { id: 'duration', label: this.tripText().duration, width: '8rem', kind: 'number' },
    { id: 'score', label: this.tripText().score, width: '7rem', kind: 'number' },
    { id: 'events', label: this.tripText().events, width: '10rem', kind: 'status' },
  ]);
  protected readonly problemColumns = computed<readonly TableColumn[]>(() => [
    { id: 'severity', label: this.v2().problems.severity, width: '8rem', kind: 'status' },
    { id: 'problem', label: this.v2().problems.problem, width: '22rem', kind: 'identity' },
    { id: 'source', label: this.v2().problems.source, width: '10rem' },
    { id: 'state', label: this.v2().problems.state, width: '10rem', kind: 'status' },
    { id: 'occurred', label: this.v2().problems.occurred, width: '12rem', kind: 'date' },
  ]);
  protected readonly serviceColumns = computed<readonly TableColumn[]>(() => [
    { id: 'task', label: this.serviceTable().task, width: '20rem', kind: 'identity' },
    { id: 'due', label: this.serviceTable().due, width: '16rem', kind: 'date' },
    { id: 'urgency', label: this.serviceTable().urgency, width: '11rem', kind: 'status' },
    { id: 'cost', label: this.serviceTable().cost, width: '9rem', kind: 'number' },
  ]);
  protected readonly edataColumns = computed<readonly TableColumn[]>(() => [
    { id: 'observation', label: this.v2().edata.observation, width: '20rem', kind: 'identity' },
    { id: 'count', label: this.v2().edata.count, width: '9rem', kind: 'number' },
    { id: 'latest', label: this.v2().edata.latest, width: '13rem', kind: 'date' },
  ]);

  protected deviceLink(id: string, tab = 'overview'): readonly string[] {
    return [...this.deviceLinkBase(), id, tab];
  }

  protected problemLink(problem: VehicleProblem): readonly string[] | null {
    return problem.deviceId
      ? this.deviceLink(
          problem.deviceId,
          problem.sourceKind === 'COMMAND' ? 'commands' : 'problems',
        )
      : null;
  }

  protected statusSeverity(status: keyof typeof statusTones) {
    return toneSeverity(statusTones[status]);
  }

  protected statusLabel(status: keyof typeof statusTones): string {
    return this.vehicles().statuses[status];
  }

  protected fuelTypeLabel(vehicle: VehicleProfile): string {
    return vehicle.fuelType ? this.vehicles().fuelTypes[vehicle.fuelType] : '—';
  }

  protected selectTab(value: string | number | undefined): void {
    const tab = vehicleProfileTabs.find((item) => item === value);
    if (tab) {
      this.tabChange.emit(tab);
    }
  }

  protected selectDevice(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.selectedDeviceId.set(event.target.value);
    }
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

  protected problemLabel(problem: VehicleProblem): string {
    const kind = Object.entries(this.alertCatalog().kinds).find(([code]) => code === problem.code);
    return (
      kind?.[1] ??
      (problem.sourceKind === 'REPORTING_GAP'
        ? this.v2().reportingGap
        : problem.sourceKind === 'COMMAND'
          ? this.v2().commandFollowUp
          : this.problemSourceLabel(problem))
    );
  }

  protected problemSourceLabel(problem: VehicleProblem): string {
    return this.v2().sources[problem.sourceKind];
  }

  protected problemStateLabel(problem: VehicleProblem): string {
    return this.v2().states[problem.state];
  }

  protected problemStateSeverity(state: VehicleProblem['state']) {
    return toneSeverity(problemStateTones[state]);
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
    if (task.kmLeft === null || task.status !== 'PLANNED') {
      return null;
    }
    const table = this.maintenance().table;
    return interpolate(task.kmLeft < 0 ? table.kmOver : table.kmLeft, {
      km: this.units.distance(Math.abs(task.kmLeft), false, 0),
      unit: this.units.distanceUnit(),
    });
  }

  protected tripLabel(trip: TripRow): string {
    return `${trip.from ?? '—'} → ${trip.to ?? '—'}`;
  }
}
