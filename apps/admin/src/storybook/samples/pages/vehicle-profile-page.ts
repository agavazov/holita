import { sampleRecordLinks } from '../record-links';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, NavigationSkipped, Router } from '@angular/router';
import type { FleetRecordLinks } from '../../../app/features/fleet/fleet-record-links';
import { MessageService } from 'primeng/api';
import { TripDrawer } from '../../../app/features/fleet/trips/trip-drawer';
import type { ServiceUrgency } from '../../../app/features/fleet/maintenance/service-task';
import {
  OdometerDrawer,
  type OdometerReading,
  type PreviousOdometerReading,
} from '../../../app/features/fleet/vehicles/odometer-drawer';
import {
  VehicleDrawer,
  type VehicleForm,
  type VehicleField,
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
import { vehicleFormErrors } from '../vehicle-validation';

const day = 86_400_000;
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Sofia',
});
const urgencyOrder = { OVERDUE: 0, DUE_SOON: 1, UNKNOWN_ODOMETER: 2, UPCOMING: 3 } as const;
const today = new Date(sampleNow).toISOString().slice(0, 10);
const soon = new Date(sampleNow + 14 * day).toISOString().slice(0, 10);

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
  imports: [VehicleProfileView, VehicleDrawer, TripDrawer, OdometerDrawer],
  template: `
    <holita-vehicle-profile-view
      [recordLinks]="recordLinks"
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
      (edit)="openEditor()"
      (recordOdometer)="reading.set(true)"
      (retry)="failed.set(false)"
      (openTrip)="openTripId.set($event)"
      (openAlert)="openAlert($event)"
      (openService)="openService($event)"
    />
    @if (reading() && profile()?.status !== 'INACTIVE' && profile(); as vehicle) {
      <holita-odometer-drawer
        [plate]="vehicle.plate"
        [previous]="previousReading()"
        [latestAllowedAt]="dataAsOf"
        [saving]="saving()"
        [saveError]="readingError()"
        (save)="saveReading($event)"
        (closed)="closeReading()"
      />
    }
    @if (editing() && form(); as form) {
      <holita-vehicle-drawer
        [vehicle]="form"
        [groups]="groups"
        [drivers]="drivers"
        [saving]="saving()"
        [saveError]="saveError()"
        [fieldErrors]="fieldErrors()"
        (save)="save($event)"
        (closed)="closeEditor()"
      />
    }
    @if (openTrip(); as trip) {
      <holita-trip-drawer
        [recordLinks]="tripRecordLinks"
        [trip]="trip"
        (closed)="openTripId.set(null)"
        (openVehicle)="openTripId.set(null)"
      />
    }
  `,
})
export class VehicleProfilePage {
  protected readonly recordLinks = sampleRecordLinks;
  protected readonly tripRecordLinks: FleetRecordLinks = {
    ...sampleRecordLinks,
    vehicle: (id) =>
      id === this.vehicle()?.id
        ? { ...sampleRecordLinks.vehicle(id), queryParams: { tab: this.tab() } }
        : sampleRecordLinks.vehicle(id),
  };
  private readonly vehicleDrawer = viewChild(VehicleDrawer);
  private readonly odometerDrawer = viewChild(OdometerDrawer);
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), [
      'loading',
      'error',
      'save-error',
      'no-odometer',
      'acknowledged-alerts',
    ]),
  );
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
    if (this.scenario() === 'loading') {
      return 'loading';
    }
    if (this.failed()) {
      return 'error';
    }
    return this.vehicle() ? 'ready' : 'not-found';
  });
  protected readonly tab = linkedSignal<VehicleProfileTab>(
    () => vehicleProfileTabs.find((tab) => tab === this.query().get('tab')) ?? 'overview',
  );
  protected readonly profile = computed(() => {
    const vehicle = this.vehicle();
    if (!vehicle) {
      return null;
    }
    const profile = vehicleProfile(vehicle);
    return this.scenario() === 'no-odometer' && !this.recordedReading()
      ? { ...profile, odometerKm: null }
      : profile;
  });
  private readonly recordedReading = linkedSignal<PreviousOdometerReading | null>(() => {
    this.params().get('id');
    return null;
  });
  protected readonly previousReading = computed<PreviousOdometerReading | null>(() => {
    const recorded = this.recordedReading();
    if (recorded) {
      return recorded;
    }
    const vehicle = this.vehicle();
    if (!vehicle || this.scenario() === 'no-odometer') {
      return null;
    }
    return {
      odometerKm: vehicle.odometerKm,
      recordedAt: vehicle.lastReportedAt ?? new Date(sampleNow - 3_600_000).toISOString(),
      source: 'DEMO',
    };
  });
  protected readonly reading = linkedSignal(() => this.query().get('drawer') === 'odometer');
  protected readonly readingError = signal<string | null>(null);
  private readingFailed = false;
  private editFailed = false;
  protected readonly saveError = signal<string | null>(null);
  protected readonly fieldErrors = signal<Partial<Record<VehicleField, string>>>({});
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
    sampleAlerts
      .filter((alert) => alert.vehicleId === this.vehicle()?.id)
      .map((alert) =>
        alertRow(
          this.scenario() === 'acknowledged-alerts' ? { ...alert, status: 'ACKNOWLEDGED' } : alert,
        ),
      ),
  );
  protected readonly service = computed(() => {
    const vehicle = this.profile();
    const odometer = vehicle?.odometerKm ?? null;
    return sampleServiceTasks
      .filter((task) => task.vehicleId === vehicle?.id)
      .map((task) => {
        const remainingKm =
          task.status !== 'PLANNED' || task.dueKm === null || odometer === null
            ? null
            : task.dueKm - odometer;
        const kmLeft =
          remainingKm === null ? null : Math.sign(remainingKm) * Math.round(Math.abs(remainingKm));
        const urgency: ServiceUrgency | null =
          task.status !== 'PLANNED'
            ? null
            : (task.dueOn !== null && task.dueOn < today) ||
                (remainingKm !== null && remainingKm <= 0)
              ? 'OVERDUE'
              : (task.dueOn !== null && task.dueOn <= soon) ||
                  (remainingKm !== null && remainingKm <= 1500)
                ? 'DUE_SOON'
                : task.dueKm !== null && odometer === null
                  ? 'UNKNOWN_ODOMETER'
                  : 'UPCOMING';
        return { ...serviceTaskRow(task), kmLeft, urgency };
      })
      .sort(
        (left, right) =>
          (left.urgency ? urgencyOrder[left.urgency] : 4) -
          (right.urgency ? urgencyOrder[right.urgency] : 4),
      );
  });
  protected readonly editing = linkedSignal(() => this.query().get('drawer') === 'edit');
  protected readonly saving = signal(false);
  protected readonly openTripId = signal<string | null>(null);
  protected readonly openTrip = computed(
    () => this.trips().find((trip) => trip.id === this.openTripId()) ?? null,
  );
  constructor() {
    // The breadcrumb: Fleet › Vehicles (a link back) › the plate.
    injectPageRecord(() => this.profile()?.plate ?? null);
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd || event instanceof NavigationSkipped) {
        this.openTripId.set(null);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  protected openAlert(id: string): void {
    void this.router.navigate(['/examples/alerts'], { queryParams: { drawer: id } });
  }

  protected openService(id: string): void {
    const task = sampleServiceTasks.find((item) => item.id === id);
    if (task) {
      void this.router.navigate(['/examples/maintenance'], {
        queryParams: { drawer: task.status === 'DONE' ? `complete-${id}` : id },
      });
    }
  }

  protected closeEditor(): void {
    this.editing.set(false);
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.clearDrawer();
  }

  protected openEditor(): void {
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.editing.set(true);
  }

  protected closeReading(): void {
    this.reading.set(false);
    this.readingError.set(null);
    this.clearDrawer();
  }

  protected saveReading(reading: OdometerReading): void {
    const id = this.vehicle()?.id;
    if (!id || this.saving() || this.vehicle()?.status === 'INACTIVE') {
      return;
    }
    this.saving.set(true);
    this.readingError.set(null);
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      if (this.scenario() === 'save-error' && !this.readingFailed) {
        this.readingFailed = true;
        this.readingError.set(vehiclesText(this.language()).odometer.saveError);
        return;
      }
      this.recordedReading.set({ ...reading, source: 'MANUAL' });
      this.vehicles.update((vehicles) =>
        vehicles.map((item) =>
          item.id === id ? { ...item, odometerKm: reading.odometerKm } : item,
        ),
      );
      this.closeReading();
      this.messages.add({
        severity: 'success',
        summary: vehiclesText(this.language()).odometer.saved,
      });
    }, saveDelayMs);
  }

  protected save(form: VehicleForm): void {
    const id = this.vehicle()?.id;
    if (!id || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      if (this.scenario() === 'save-error' && !this.editFailed) {
        this.editFailed = true;
        this.saveError.set(vehiclesText(this.language()).drawer.saveError);
        return;
      }
      const errors = vehicleFormErrors(
        this.vehicles(),
        id,
        form,
        vehiclesText(this.language()).drawer,
      );
      if (Object.keys(errors).length) {
        this.fieldErrors.set(errors);
        return;
      }
      this.vehicles.update((vehicles) =>
        vehicles.map((item) =>
          item.id === id
            ? { ...item, ...form, updatedAt: new Date(sampleNow).toISOString() }
            : item,
        ),
      );
      this.closeEditor();
      this.messages.add({
        severity: 'success',
        summary: interpolate(vehiclesText(this.language()).notices.saved, { plate: form.plate }),
      });
    }, saveDelayMs);
  }

  canLeave(): boolean | Promise<boolean> {
    return this.saving()
      ? false
      : (this.vehicleDrawer()?.canLeave() ?? this.odometerDrawer()?.canLeave() ?? true);
  }
}
