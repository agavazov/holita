import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TripDrawer } from '../../../app/features/fleet/trips/trip-drawer';
import {
  VehicleDrawer,
  type VehicleForm,
} from '../../../app/features/fleet/vehicles/vehicle-drawer';
import {
  type VehicleProfileTab,
  vehicleProfileTabs,
  VehicleProfileView,
} from '../../../app/features/fleet/vehicles/vehicle-profile-view';
import { vehiclesText } from '../../../app/features/fleet/vehicles/i18n/messages';
import type { Language } from '../../../app/i18n/messages';
import { injectPageRecord } from '../../../app/layout/page-record';
import type { SeriesPoint } from '../../../app/ui/charts/column-series';
import { formatNumber } from '../../../app/ui/format/format';
import { interpolate } from '../../../app/ui/i18n/messages';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import {
  sampleAlerts,
  sampleDrivers,
  sampleGroups,
  sampleNow,
  sampleServiceTasks,
  sampleTrips,
  type SampleVehicle,
  sampleVehicles,
} from '../fleet-samples';
import { alertRow, serviceTaskRow, tripRow, vehicleForm, vehicleProfile } from '../rows';
import { injectClearDrawer, injectQueryParams, saveDelayMs, scenarioOf } from '../scenario';

const day = 86_400_000;
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Sofia',
});
const urgencyOrder = { OVERDUE: 0, DUE_SOON: 1, OK: 2, DONE: 3 } as const;

/** Deterministic daily distances of the last 14 days (no data before the vehicle reported). */
function distanceSeries(vehicle: SampleVehicle, language: Language): readonly SeriesPoint[] {
  const seed = Number(vehicle.id.replace(/\D/g, '')) || 1;
  return Array.from({ length: 14 }, (_, index) => {
    const at = sampleNow - (13 - index) * day;
    const weekday = new Date(at).getUTCDay();
    const value =
      vehicle.activity === 'NO_DEVICE'
        ? null
        : vehicle.status === 'INACTIVE' || weekday === 0
          ? 0
          : ((seed * 31 + index * 57) % 380) + 60;
    return {
      key: String(index),
      label: dayLabel.format(at),
      value,
      valueText: value === null ? '—' : `${formatNumber(value, language)} km`,
    };
  });
}

/**
 * Story-only host of the vehicle profile: the record, its trips, alerts and service plan from
 * the samples; Edit opens the vehicle drawer, a trip opens the trip drawer and an alert opens the
 * Alerts page on that alert. `?scenario=loading|error` and `?tab=` open the stories' states.
 */
@Component({
  selector: 'holita-example-vehicle-profile-page',
  imports: [VehicleProfileView, VehicleDrawer, TripDrawer],
  template: `
    <holita-vehicle-profile-view
      [state]="state()"
      [vehicle]="profile()"
      [dataAsOf]="dataAsOf"
      [backLink]="['/examples/vehicles']"
      [distance]="distance()"
      [trips]="trips()"
      [alerts]="alerts()"
      [service]="service()"
      [tab]="tab()"
      (tabChange)="tab.set($event)"
      (edit)="editing.set(true)"
      (retry)="failed.set(false)"
      (openTrip)="openTripId.set($event)"
      (openAlert)="openAlert($event)"
    />
    @if (editing() && form(); as form) {
      <holita-vehicle-drawer
        [vehicle]="form"
        [groups]="groups"
        [drivers]="drivers"
        [saving]="saving()"
        (save)="save($event)"
        (closed)="closeEditor()"
      />
    }
    @if (openTrip(); as trip) {
      <holita-trip-drawer
        [trip]="trip"
        (closed)="openTripId.set(null)"
        (openVehicle)="openTripId.set(null)"
      />
    }
  `,
})
export class VehicleProfilePage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly scenario = computed(() => scenarioOf(this.query(), ['loading', 'error']));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly dataAsOf = new Date(sampleNow).toISOString();
  protected readonly groups = sampleGroups.map((group) => ({ id: group.id, name: group.name }));
  protected readonly drivers = sampleDrivers
    .filter((driver) => driver.status !== 'INACTIVE')
    .map((driver) => ({ id: driver.id, name: driver.name }));

  private readonly vehicles = signal<readonly SampleVehicle[]>(sampleVehicles);
  private readonly vehicle = computed(() =>
    this.vehicles().find((item) => item.id === this.params().get('id')),
  );
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  protected readonly state = computed(() => {
    if (this.scenario() === 'loading') return 'loading';
    if (this.failed()) return 'error';
    return this.vehicle() ? 'ready' : 'not-found';
  });
  protected readonly tab = linkedSignal<VehicleProfileTab>(
    () => vehicleProfileTabs.find((tab) => tab === this.query().get('tab')) ?? 'overview',
  );
  protected readonly profile = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? vehicleProfile(vehicle) : null;
  });
  protected readonly form = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? vehicleForm(vehicle) : null;
  });
  protected readonly distance = computed(() => {
    const vehicle = this.vehicle();
    return vehicle ? distanceSeries(vehicle, this.language()) : [];
  });
  protected readonly trips = computed(() =>
    sampleTrips.filter((trip) => trip.vehicleId === this.vehicle()?.id).map(tripRow),
  );
  protected readonly alerts = computed(() =>
    sampleAlerts.filter((alert) => alert.vehicleId === this.vehicle()?.id).map(alertRow),
  );
  protected readonly service = computed(() =>
    sampleServiceTasks
      .filter((task) => task.vehicleId === this.vehicle()?.id)
      .map(serviceTaskRow)
      .sort((left, right) => urgencyOrder[left.urgency] - urgencyOrder[right.urgency]),
  );
  protected readonly editing = linkedSignal(() => this.query().get('drawer') === 'edit');
  protected readonly saving = signal(false);
  protected readonly openTripId = signal<string | null>(null);
  protected readonly openTrip = computed(
    () => this.trips().find((trip) => trip.id === this.openTripId()) ?? null,
  );
  constructor() {
    // The breadcrumb: Fleet › Vehicles (a link back) › the plate.
    injectPageRecord(() => this.profile()?.plate ?? null);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  protected openAlert(id: string): void {
    void this.router.navigate(['/examples/alerts'], { queryParams: { drawer: id } });
  }

  protected closeEditor(): void {
    this.editing.set(false);
    this.clearDrawer();
  }

  protected save(form: VehicleForm): void {
    const id = this.vehicle()?.id;
    if (!id || this.saving()) return;
    this.saving.set(true);
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      this.vehicles.update((vehicles) =>
        vehicles.map((item) =>
          item.id === id ? { ...item, ...form, year: form.year ?? item.year } : item,
        ),
      );
      this.closeEditor();
      this.messages.add({
        severity: 'success',
        summary: interpolate(vehiclesText(this.language()).notices.saved, { plate: form.plate }),
      });
    }, saveDelayMs);
  }
}
