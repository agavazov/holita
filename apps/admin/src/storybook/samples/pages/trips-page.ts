import { Component, computed, linkedSignal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TripDrawer } from '../../../app/features/fleet/trips/trip-drawer';
import {
  type TripActionId,
  type TripKpis,
  type TripRow,
  TripsView,
} from '../../../app/features/fleet/trips/trips-view';
import type { ListActionRequest } from '../../../app/ui/list/list-actions';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { sampleDrivers, sampleTrips, sampleNow, sampleVehicles } from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import { tripRow } from '../rows';
import { injectBranchName, injectClearDrawer, injectQueryParams, scenarioOf } from '../scenario';

const definition: SampleListDefinition<TripRow> = {
  id: (trip) => trip.id,
  search: (trip) => [trip.plate, trip.driverName, trip.from, trip.to],
  columns: {
    startedAt: (trip) => trip.startedAt,
    vehicle: (trip) => trip.vehicleId,
    driver: (trip) => trip.driverId ?? null,
    distance: (trip) => trip.distanceKm,
    duration: (trip) => trip.durationMin,
    score: (trip) => trip.score,
    hasEvents: (trip) => trip.events.length > 0,
  },
  secondarySorts: {
    distance: [{ value: (trip) => trip.startedAt, direction: 'desc' }],
    score: [{ value: (trip) => trip.startedAt, direction: 'desc' }],
  },
};

function kpisOf(trips: readonly TripRow[]): TripKpis {
  const scores = trips.flatMap((trip) => (trip.score === null ? [] : [trip.score]));
  return {
    trips: trips.length,
    distanceKm: trips.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0),
    drivingMin: trips.reduce((sum, trip) => sum + (trip.durationMin ?? 0), 0),
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    events: trips.reduce((sum, trip) => sum + trip.events.length, 0),
  };
}

/** Story-only host of the Trips example: a read-only list and view drawer over sample trips. */
@Component({
  selector: 'holita-example-trips-page',
  imports: [TripsView, TripDrawer],
  template: `
    <holita-trips-view
      [branchName]="branchName()"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [vehicles]="vehicles"
      [drivers]="drivers"
      (stateChange)="state.set($event)"
      (action)="run($event)"
      (retry)="failed.set(false)"
    />
    @if (openTrip(); as trip) {
      <holita-trip-drawer
        [trip]="trip"
        (closed)="closeDrawer()"
        (openVehicle)="openVehicle($event)"
      />
    }
  `,
})
export class TripsPage {
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'in-progress', 'missing-end']),
  );

  protected readonly branchName = injectBranchName();
  protected readonly vehicles = sampleVehicles
    .filter((vehicle) => sampleTrips.some((trip) => trip.vehicleId === vehicle.id))
    .map((vehicle) => ({ id: vehicle.id, name: vehicle.plate }));
  protected readonly drivers = sampleDrivers.map((driver) => ({
    id: driver.id,
    name: driver.name,
  }));
  private readonly trips = computed<readonly TripRow[]>(() => {
    if (this.scenario() === 'empty') return [];
    const rows = sampleTrips.map(tripRow);
    if (this.scenario() !== 'in-progress' && this.scenario() !== 'missing-end') return rows;
    return rows.map((row) =>
      row.id !== 't001'
        ? row
        : {
            ...row,
            startedAt: new Date(
              sampleNow - (this.scenario() === 'in-progress' ? 1 : 48) * 3_600_000,
            ).toISOString(),
            endedAt: null,
            from: null,
            to: null,
            distanceKm: null,
            durationMin: null,
            maxSpeedKph: null,
            fuelUsedL: null,
            score: null,
            events: [],
            inProgress: this.scenario() === 'in-progress',
          },
    );
  });
  protected readonly state = signal<ListQuery>(
    initialQuery({ field: 'startedAt', direction: 'desc' }),
  );
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  protected readonly openId = linkedSignal(() => this.query().get('drawer'));
  protected readonly openTrip = computed(() => {
    const trip = this.trips().find((item) => item.id === this.openId());
    return trip ?? null;
  });

  protected readonly result = computed(() => runSampleList(this.trips(), definition, this.state()));
  protected readonly rows = computed(() => this.result().items);
  protected readonly listState = computed(() => ({ ...this.state(), page: this.result().page }));
  protected readonly kpis = computed(() =>
    this.scenario() === 'loading' || this.failed() ? null : kpisOf(this.trips()),
  );
  protected readonly view = computed(() =>
    sampleTableView(this.state(), this.rows().length, {
      loading: this.scenario() === 'loading',
      failed: this.failed(),
    }),
  );

  /** Row actions of the read-only list: each runs on one trip. */
  protected run({ action, ids }: ListActionRequest<TripActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'open':
        if (id) this.openId.set(id);
        return;
      case 'vehicle': {
        const trip = this.trips().find((item) => item.id === id);
        if (trip) this.openVehicle(trip.vehicleId);
        return;
      }
    }
  }

  protected openVehicle(vehicleId: string): void {
    void this.router.navigate(['/examples/vehicles', vehicleId]);
  }

  protected closeDrawer(): void {
    this.openId.set(null);
    this.clearDrawer();
  }
}
