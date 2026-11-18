import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Truck } from '@primeicons/angular/truck';
import { Wifi } from '@primeicons/angular/wifi';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { Compass } from '@primeicons/angular/compass';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  AdminFleetOverviewQuery,
  AdminOverviewMapQuery,
  AdminOverviewConnectedDevicesQuery,
  AdminOverviewProblemFragment,
} from '../../../../generated/graphql/operations';
import {
  ChartPanel,
  type ChartPanelPoint,
  type ChartPanelSelection,
  type ChartPanelSeries,
} from '../../../ui/chart-panel/chart-panel';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import { KpiStrip } from '../../../ui/kpi/kpi-strip';
import { KpiTile } from '../../../ui/kpi/kpi-tile';
import { LocationMap, type LocationMapRecord } from '../../../ui/location-map/location-map';
import { TablePanel, type TableColumn } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { PageHeader } from '../../../ui/page-header/page-header';
import { maintenanceText } from '../maintenance/i18n/messages';
import { overviewText } from './i18n/messages';
import { problemTitle, problemsText, problemSeverityTones } from './problems-presentation';
import type { OverviewDays, OverviewFilter, overviewPeriod } from './overview-period';

export interface OverviewLinks {
  readonly overview: readonly string[];
  readonly problems: readonly string[];
  readonly trips: readonly string[];
  readonly vehicles: readonly string[];
  readonly devices: readonly string[];
  readonly maintenance: readonly string[];
  readonly drivers: readonly string[];
}

@Component({
  selector: 'discocan-overview-view',
  imports: [
    RouterLink,
    PageHeader,
    FormsModule,
    ButtonDirective,
    Message,
    Select,
    Skeleton,
    Tag,
    Truck,
    Wifi,
    ExclamationTriangle,
    Compass,
    ChartPanel,
    EmptyState,
    KpiStrip,
    KpiTile,
    LocationMap,
    TablePanel,
    TableModule,
  ],
  templateUrl: './overview-view.html',
  styleUrl: './overview-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class OverviewView {
  readonly branchName = input.required<string>();
  readonly data = input<AdminFleetOverviewQuery | null>(null);
  readonly loading = input(false);
  readonly errorText = input<string | null>(null);
  readonly links = input.required<OverviewLinks>();
  readonly days = input.required<OverviewDays>();
  readonly period = input.required<ReturnType<typeof overviewPeriod>>();
  readonly filter = input<OverviewFilter>('all');
  readonly vehicleId = input<string | null>(null);
  readonly mapData = input<AdminOverviewMapQuery['fleetMap'] | null>(null);
  readonly mapLoading = input(false);
  readonly mapError = input<string | null>(null);
  readonly devicesData = input<AdminOverviewConnectedDevicesQuery['fleetDevices'] | null>(null);
  readonly devicesLoading = input(false);
  readonly devicesError = input<string | null>(null);
  readonly retry = output();
  readonly periodChange = output<OverviewDays>();
  readonly filterChange = output<OverviewFilter>();
  readonly vehicleSelect = output<string | null>();
  protected readonly units = injectFleetFormat();
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => overviewText(this.language()));
  protected readonly problemText = computed(() => problemsText(this.language()));
  protected readonly summary = computed(() => this.data()?.fleetDashboard ?? null);
  protected readonly number = (value: number | null | undefined) =>
    formatNumber(value, this.language());
  protected readonly toneSeverity = toneSeverity;
  protected readonly problemSeverityTones = problemSeverityTones;
  protected readonly periods = computed(() =>
    [7, 14, 30].map((value) => ({
      value,
      label: interpolate(this.text().periodDays, { days: value }),
    })),
  );
  protected readonly periodLabel = computed(() =>
    this.units.dateRange(this.period().fromDate, this.period().toDate),
  );
  protected readonly tripParams = computed(() =>
    this.tripDateParams(this.period().fromDate, this.period().toDate),
  );
  protected readonly problemParams = computed(() => ({
    attention: 'true',
    from: this.period().from,
    to: this.period().to,
  }));
  protected readonly attention = computed(() => {
    const data = this.data();
    return data
      ? [...data.critical.items, ...data.warning.items, ...data.information.items].slice(0, 5)
      : [];
  });
  protected readonly mapFilters = computed(() => [
    { value: 'all', label: this.text().map.all },
    { value: 'live', label: this.text().connection.live },
    { value: 'waiting', label: this.text().connection.waiting },
    { value: 'disconnected', label: this.text().connection.disconnected },
    { value: 'connected', label: this.text().kpis.connected },
  ]);
  protected readonly filteredVehicles = computed(() =>
    (this.mapData()?.items ?? []).filter((record) => {
      if (this.vehicleId() && record.vehicle.id !== this.vehicleId()) {
        return false;
      }
      return this.filter() === 'live'
        ? record.live
        : this.filter() === 'waiting'
          ? record.connected && !record.live
          : this.filter() === 'disconnected'
            ? !record.connected
            : true;
    }),
  );
  protected readonly mapRecords = computed<readonly LocationMapRecord[]>(() =>
    this.filteredVehicles().map((record): LocationMapRecord => {
      const key = record.live ? 'live' : record.connected ? 'waiting' : 'disconnected';
      const label = [
        this.text().connection[key],
        ...(!record.position ? [this.text().map.noPosition] : []),
      ].join(' · ');
      return {
        id: record.vehicle.id,
        label: record.vehicle.licensePlate,
        plate: record.vehicle.licensePlate,
        status: {
          label,
          tone: !record.position
            ? 'neutral'
            : record.live
              ? 'success'
              : record.connected
                ? 'warn'
                : 'neutral',
        },
        position: record.position
          ? { latitude: record.position.latitude, longitude: record.position.longitude }
          : null,
        positionAt: record.position?.recordedAt ?? null,
        heading: record.position?.headingDeg ?? null,
        moving: record.activity === 'MOVING',
        href: '/' + [...this.links().vehicles.slice(1), record.vehicle.id, 'overview'].join('/'),
      };
    }),
  );
  protected readonly coverage = computed(() =>
    interpolate(this.text().map.coverage, {
      positioned: this.number(this.mapData()?.withPosition),
      total: this.number(this.mapData()?.total),
      missing: this.number(this.mapData()?.withoutPosition),
    }),
  );
  protected readonly mapProgress = computed(() =>
    interpolate(this.text().map.progress, {
      loaded: this.number(this.mapData()?.items.length ?? 0),
      total: this.number(this.mapData()?.total),
    }),
  );
  protected readonly selectedVehicle = computed(
    () => this.mapData()?.items.find((item) => item.vehicle.id === this.vehicleId()) ?? null,
  );
  protected readonly connectedDevices = computed(() =>
    (this.devicesData()?.items ?? []).filter((device) => device.ermState?.online),
  );
  protected readonly deviceColumns = computed<readonly TableColumn[]>(() => [
    { id: 'device', label: this.text().devices.device, width: '13rem', kind: 'identity' },
    { id: 'vehicle', label: this.text().devices.vehicle, width: '12rem', kind: 'text' },
    { id: 'report', label: this.text().devices.lastReport, width: '15rem', kind: 'date' },
  ]);
  protected readonly devicesView = computed(() =>
    tableView({
      loading: this.devicesLoading(),
      error: this.devicesError(),
      rows: this.devicesData() ? this.connectedDevices().length : null,
      filtered: false,
    }),
  );
  protected readonly devicesComplete = computed(() => {
    const data = this.devicesData();
    return !!data && data.offset + data.limit >= data.total;
  });
  protected readonly devicesProgress = computed(() =>
    interpolate(this.text().devices.progress, {
      loaded: this.number(this.devicesData()?.items.length ?? 0),
      total: this.number(this.devicesData()?.total),
    }),
  );
  protected readonly connectionPoints = computed<readonly ChartPanelPoint[]>(() => [
    { id: 'live', label: this.text().connection.live, tone: 'success' },
    { id: 'waiting', label: this.text().connection.waiting, tone: 'warn' },
    { id: 'disconnected', label: this.text().connection.disconnected, tone: 'neutral' },
  ]);
  protected readonly connectionSeries = computed<readonly ChartPanelSeries[]>(() => {
    const vehicles = this.summary()?.vehicles;
    return vehicles
      ? [
          {
            id: 'vehicles',
            label: this.text().connection.vehicles,
            values: [
              vehicles.live,
              vehicles.connected - vehicles.live,
              vehicles.total - vehicles.connected,
            ],
          },
        ]
      : [];
  });
  protected readonly connectionSummary = computed(() =>
    interpolate(this.text().connection.summary, {
      live: this.number(this.summary()?.vehicles.live),
      connected: this.number(this.summary()?.vehicles.connected),
      total: this.number(this.summary()?.vehicles.total),
    }),
  );
  protected readonly distanceData = computed(() =>
    (this.data()?.fleetDailyDistance.points ?? []).filter(
      (point) => point.date >= this.period().fromDate && point.date <= this.period().toDate,
    ),
  );
  protected readonly distancePoints = computed<readonly ChartPanelPoint[]>(() =>
    this.distanceData().map((point) => ({
      id: point.date,
      label: this.units.dateOnly(point.date),
    })),
  );
  protected readonly distanceSeries = computed<readonly ChartPanelSeries[]>(() => [
    {
      id: 'distance',
      label: this.text().distance.title,
      category: 'c2',
      values: this.distanceData().map((point) => this.units.distanceValue(point.distanceKm)),
    },
  ]);
  protected readonly distancePeriod = computed(() =>
    this.units.dateRange(this.distanceData()[0]?.date, this.distanceData().at(-1)?.date),
  );
  protected readonly maintenanceParams = {
    conditions: JSON.stringify([
      { id: 'dashboard-overdue', field: 'urgency', operator: 'isAnyOf', values: ['OVERDUE'] },
      {
        id: 'dashboard-active',
        field: 'vehicleStatus',
        operator: 'isAnyOf',
        values: ['ACTIVE', 'IN_WORKSHOP'],
      },
    ]),
  };
  protected readonly driverParams = {
    conditions: JSON.stringify([
      { id: 'dashboard-active', field: 'status', operator: 'isAnyOf', values: ['ACTIVE'] },
    ]),
  };
  protected readonly tripDistance = computed(() =>
    this.units.distance(this.summary()?.trips.distanceKm ?? null, true, 0),
  );
  protected readonly distanceCoverage = computed(() =>
    interpolate(this.text().kpis.distanceCoverage, {
      measured: this.number(this.summary()?.trips.distanceKnownTrips),
      total: this.number(this.summary()?.trips.total),
    }),
  );
  protected readonly vehicleTotal = computed(() =>
    interpolate(this.text().kpis.vehicleTotal, {
      count: this.number(this.summary()?.vehicles.total),
    }),
  );
  protected readonly deviceTotal = computed(() =>
    interpolate(this.text().kpis.deviceTotal, {
      count: this.number(this.summary()?.devices.total),
    }),
  );
  protected readonly documentsSummary = computed(() =>
    interpolate(this.text().drivers.documents, {
      count: this.number(this.data()?.documents.total),
    }),
  );
  protected readonly maintenanceSummary = computed(() =>
    interpolate(this.text().maintenance.summary, {
      count: this.number(this.data()?.overdue.total),
    }),
  );

  protected vehicleLink(id: string): readonly string[] {
    return [...this.links().vehicles, id, 'overview'];
  }
  protected deviceLink(id: string): readonly string[] {
    return [...this.links().devices, id, 'overview'];
  }
  protected maintenanceLink(id: string): readonly string[] {
    return [...this.links().maintenance, id, 'edit'];
  }
  protected driverLink(id: string): readonly string[] {
    return [...this.links().drivers, id];
  }
  protected problemTitle(problem: AdminOverviewProblemFragment): string {
    return problemTitle(problem, this.language());
  }
  protected problemLink(problem: AdminOverviewProblemFragment): readonly string[] {
    return problem.alertId ? [...this.links().problems, problem.alertId] : this.links().problems;
  }
  protected problemQuery(problem: AdminOverviewProblemFragment) {
    return {
      ...this.problemParams(),
      source: problem.sourceKind,
      ...(problem.vehicleId
        ? { vehicleIds: problem.vehicleId }
        : problem.deviceId
          ? { deviceIds: problem.deviceId }
          : {}),
    };
  }
  protected serviceTitle(task: AdminFleetOverviewQuery['overdue']['items'][number]): string {
    return task.title ?? maintenanceText(this.language()).serviceTypes[task.serviceType];
  }
  protected selectConnection(selection: ChartPanelSelection): void {
    const value = selection.point.id;
    if (value === 'live' || value === 'waiting' || value === 'disconnected') {
      this.filterChange.emit(value);
    }
  }
  protected tripDateParams(from: string, to: string) {
    return {
      conditions: JSON.stringify([
        { id: 'dashboard-period', field: 'startedAt', operator: 'between', values: [from, to] },
      ]),
    };
  }
  protected distanceSelect(selection: ChartPanelSelection): void {
    this.distanceDaySelect.emit(selection.point.id);
  }
  readonly distanceDaySelect = output<string>();
}
