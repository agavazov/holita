import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  type AttentionItem,
  type OverviewKpis,
  type OverviewLinks,
  OverviewView,
} from '../../../app/features/fleet/overview/overview-view';
import type { SeriesPoint } from '../../../app/ui/charts/column-series';
import type { StackedRow } from '../../../app/ui/charts/stacked-bars';
import type { Language } from '../../../app/i18n/messages';
import { formatNumber } from '../../../app/ui/format/format';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import { fixtureBranches } from '../../session-fixtures';
import {
  sampleAlerts,
  sampleDevices,
  sampleDrivers,
  sampleGroups,
  sampleNow,
  sampleServiceTasks,
  sampleTrips,
  sampleVehicles,
  vehicleById,
} from '../fleet-samples';
import { tripRow } from '../rows';
import { injectQueryParams, scenarioOf } from '../scenario';

const day = 86_400_000;
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Sofia',
});
const links: OverviewLinks = {
  vehicles: ['/examples/vehicles'],
  alerts: ['/examples/alerts'],
  maintenance: ['/examples/maintenance'],
  trips: ['/examples/trips'],
};

/** Deterministic fleet distance of the last 14 days (lower on Sundays). */
function fleetDistance(language: Language): readonly SeriesPoint[] {
  return Array.from({ length: 14 }, (_, index) => {
    const at = sampleNow - (13 - index) * day;
    const sunday = new Date(at).getUTCDay() === 0;
    const value = sunday ? 2100 + index * 37 : 9400 + ((index * 1373) % 2600);
    return {
      key: String(index),
      label: dayLabel.format(at),
      value,
      valueText: `${formatNumber(value, language)} km`,
    };
  });
}

function activityByGroup(language: Language): readonly StackedRow[] {
  return sampleGroups.map((group) => {
    const vehicles = sampleVehicles.filter(
      (vehicle) => vehicle.groupId === group.id && vehicle.status !== 'INACTIVE',
    );
    const count = (activity: string) =>
      vehicles.filter((vehicle) => vehicle.activity === activity).length;
    return {
      key: group.id,
      label: group.name,
      total: vehicles.length,
      totalText: formatNumber(vehicles.length, language),
      segments: [
        { key: 'moving', value: count('MOVING'), tone: 'success' },
        { key: 'idle', value: count('IDLE'), tone: 'info' },
        { key: 'parked', value: count('PARKED'), tone: 'muted' },
        { key: 'notReporting', value: count('NOT_CONNECTED'), tone: 'danger' },
      ],
    };
  });
}

function attentionItems(): readonly AttentionItem[] {
  const critical = sampleAlerts.filter(
    (alert) => alert.status === 'OPEN' && alert.severity === 'CRITICAL',
  );
  const overdue = sampleServiceTasks.filter((task) => task.urgency === 'OVERDUE');
  const today = new Date(sampleNow).toISOString().slice(0, 10);
  const expired = sampleDrivers.filter(
    (driver) => driver.licenseExpiresOn < today || driver.tachoCardExpiresOn < today,
  );
  const offline = sampleDevices.filter((device) => device.status === 'OFFLINE');
  return [
    ...critical.slice(0, 3).map((alert) => ({
      key: alert.id,
      tone: 'danger' as const,
      title: `${alert.kind} · ${vehicleById(alert.vehicleId)?.plate ?? '—'}`,
      detail: alert.detail,
      link: ['/examples/alerts'],
      queryParams: { drawer: alert.id },
    })),
    ...overdue.slice(0, 2).map((task) => ({
      key: task.id,
      tone: 'warn' as const,
      title: `${task.kind} overdue · ${vehicleById(task.vehicleId)?.plate ?? '—'}`,
      detail: task.dueOn ? `Due ${task.dueOn}` : 'Due by odometer',
      link: ['/examples/maintenance'],
      queryParams: { drawer: task.id },
    })),
    ...expired.slice(0, 2).map((driver) => ({
      key: driver.id,
      tone: 'warn' as const,
      title: `Expired document · ${driver.name}`,
      detail: 'Driving licence or tachograph card has expired.',
      link: ['/examples/drivers'],
      queryParams: { drawer: driver.id },
    })),
    {
      key: 'offline',
      tone: 'danger' as const,
      title: `${String(offline.length)} trackers offline`,
      detail: 'No connection for more than 48 hours.',
      link: ['/examples/devices'],
    },
  ];
}

/** Story-only host of the Overview example: dashboard figures computed from the samples. */
@Component({
  selector: 'holita-example-overview-page',
  imports: [OverviewView],
  template: `
    <holita-overview-view
      [state]="state()"
      [branchName]="branchName"
      [dataAsOf]="dataAsOf"
      [links]="links"
      [kpis]="kpis"
      [attention]="attention()"
      [distance]="distance"
      [activity]="activity"
      [trips]="trips"
      (retry)="failed.set(false)"
    />
  `,
})
export class OverviewPage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly query = injectQueryParams();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'error', 'calm']),
  );

  protected readonly branchName = fixtureBranches[0].name;
  protected readonly dataAsOf = new Date(sampleNow).toISOString();
  protected readonly links = links;
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  protected readonly state = computed(() =>
    this.scenario() === 'loading' ? 'loading' : this.failed() ? 'error' : 'ready',
  );
  protected readonly kpis: OverviewKpis = {
    moving: sampleVehicles.filter((vehicle) => vehicle.activity === 'MOVING').length,
    active: sampleVehicles.filter((vehicle) => vehicle.status === 'ACTIVE').length,
    distanceTodayKm: 6120,
    criticalAlerts: sampleAlerts.filter(
      (alert) => alert.status === 'OPEN' && alert.severity === 'CRITICAL',
    ).length,
    overdueService: sampleServiceTasks.filter((task) => task.urgency === 'OVERDUE').length,
    notReporting: sampleVehicles.filter((vehicle) => vehicle.activity === 'NOT_CONNECTED').length,
  };
  /** `?scenario=calm` shows the dashboard with nothing to handle. */
  protected readonly attention = computed(() =>
    this.scenario() === 'calm' ? [] : attentionItems(),
  );
  protected readonly distance = fleetDistance(this.language());
  protected readonly activity = activityByGroup(this.language());
  protected readonly trips = sampleTrips.slice(0, 5).map(tripRow);
}
