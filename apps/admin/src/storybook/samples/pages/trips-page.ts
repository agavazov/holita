import { Component, computed, linkedSignal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TripDrawer } from '../../../app/features/fleet/trips/trip-drawer';
import { type TripKpis, TripsView } from '../../../app/features/fleet/trips/trips-view';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { fixtureBranches } from '../../session-fixtures';
import {
  driverById,
  sampleDrivers,
  type SampleTrip,
  sampleTrips,
  sampleVehicles,
  vehicleById,
} from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import { tripRow } from '../rows';
import { injectQueryParams, scenarioOf } from '../scenario';

const definition: SampleListDefinition<SampleTrip> = {
  search: (trip) => [
    vehicleById(trip.vehicleId)?.plate ?? null,
    driverById(trip.driverId)?.name ?? null,
    trip.from,
    trip.to,
  ],
  columns: {
    startedAt: (trip) => trip.startedAt,
    vehicle: (trip) => trip.vehicleId,
    driver: (trip) => trip.driverId,
    distance: (trip) => trip.distanceKm,
    duration: (trip) => trip.durationMin,
    score: (trip) => trip.score,
    hasEvents: (trip) => trip.events.length > 0,
  },
};

function kpisOf(trips: readonly SampleTrip[]): TripKpis {
  const scores = trips.flatMap((trip) => (trip.score === null ? [] : [trip.score]));
  return {
    trips: trips.length,
    distanceKm: trips.reduce((sum, trip) => sum + trip.distanceKm, 0),
    drivingMin: trips.reduce((sum, trip) => sum + trip.durationMin, 0),
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
      [branchName]="branchName"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [vehicles]="vehicles"
      [drivers]="drivers"
      (stateChange)="state.set($event)"
      (open)="openId.set($event)"
      (rowAction)="rowAction($event.action, $event.id)"
      (retry)="failed.set(false)"
    />
    @if (openTrip(); as trip) {
      <holita-trip-drawer
        [trip]="trip"
        (closed)="openId.set(null)"
        (openVehicle)="openVehicle($event)"
      />
    }
  `,
})
export class TripsPage {
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error']),
  );

  protected readonly branchName = fixtureBranches[0].name;
  protected readonly vehicles = sampleVehicles
    .filter((vehicle) => sampleTrips.some((trip) => trip.vehicleId === vehicle.id))
    .map((vehicle) => ({ id: vehicle.id, name: vehicle.plate }));
  protected readonly drivers = sampleDrivers.map((driver) => ({
    id: driver.id,
    name: driver.name,
  }));
  private readonly trips = computed(() => (this.scenario() === 'empty' ? [] : sampleTrips));
  protected readonly state = signal<ListQuery>(
    initialQuery({ field: 'startedAt', direction: 'desc' }),
  );
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  protected readonly openId = linkedSignal(() => this.query().get('drawer'));
  protected readonly openTrip = computed(() => {
    const trip = this.trips().find((item) => item.id === this.openId());
    return trip ? tripRow(trip) : null;
  });

  protected readonly result = computed(() => runSampleList(this.trips(), definition, this.state()));
  protected readonly rows = computed(() => this.result().items.map(tripRow));
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

  protected rowAction(action: string, id: string): void {
    if (action === 'open') this.openId.set(id);
    if (action === 'vehicle') {
      const trip = this.trips().find((item) => item.id === id);
      if (trip) this.openVehicle(trip.vehicleId);
    }
  }

  protected openVehicle(vehicleId: string): void {
    void this.router.navigate(['/examples/vehicles', vehicleId]);
  }
}
