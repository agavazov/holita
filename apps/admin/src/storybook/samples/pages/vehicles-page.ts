import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  VehicleDrawer,
  type VehicleField,
  type VehicleForm,
} from '../../../app/features/fleet/vehicles/vehicle-drawer';
import {
  type VehicleActionId,
  type VehicleKpis,
  VehiclesView,
} from '../../../app/features/fleet/vehicles/vehicles-view';
import { vehiclesText } from '../../../app/features/fleet/vehicles/i18n/messages';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListActionRequest, ListRecord } from '../../../app/ui/list/list-actions';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import {
  driverById,
  sampleDrivers,
  sampleDevices,
  sampleTrips,
  sampleAlerts,
  sampleServiceTasks,
  sampleGroups,
  sampleNow,
  type SampleVehicle,
  sampleVehicles,
} from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import { sampleFuelStatus, vehicleForm, vehicleRow } from '../rows';
import { vehicleFormErrors } from '../vehicle-validation';
import {
  injectBranchName,
  injectClearDrawer,
  injectQueryParams,
  saveDelayMs,
  scenarioOf,
} from '../scenario';

const definition: SampleListDefinition<SampleVehicle> = {
  id: (vehicle) => vehicle.id,
  search: (vehicle) => [
    vehicle.plate,
    vehicle.fleetNumber,
    vehicle.make,
    vehicle.model,
    driverById(vehicle.driverId)?.name ?? null,
    vehicle.notes,
  ],
  columns: {
    plate: (vehicle) => vehicle.plate,
    fleetNumber: (vehicle) => vehicle.fleetNumber || null,
    status: (vehicle) => vehicle.status,
    activity: (vehicle) => vehicle.activity,
    group: (vehicle) => vehicle.groupId,
    type: (vehicle) => vehicle.type,
    make: (vehicle) => vehicle.make,
    odometer: (vehicle) => vehicle.odometerKm,
    year: (vehicle) => vehicle.year,
    hasDriver: (vehicle) => vehicle.driverId !== null,
    driver: (vehicle) => vehicle.driverId,
    fuelType: (vehicle) => vehicle.fuelType,
    hasDevice: (vehicle) => sampleDevices.some((device) => device.vehicleId === vehicle.id),
    hasOpenAlerts: (vehicle) => vehicleRow(vehicle).openAlerts > 0,
    createdAt: (vehicle) => vehicle.createdAt,
    updatedAt: (vehicle) => vehicle.updatedAt,
    lastReportedAt: (vehicle) => vehicle.lastReportedAt,
  },
};

function kpisOf(vehicles: readonly SampleVehicle[]): VehicleKpis {
  const count = (test: (vehicle: SampleVehicle) => boolean) => vehicles.filter(test).length;
  return {
    inOperation: count((vehicle) => vehicle.status !== 'INACTIVE'),
    inWorkshop: count((vehicle) => vehicle.status === 'IN_WORKSHOP'),
    moving: count((vehicle) => vehicle.activity === 'MOVING'),
    notReporting: count((vehicle) => vehicle.activity === 'NOT_CONNECTED'),
    openAlerts: vehicles.reduce((sum, vehicle) => sum + vehicleRow(vehicle).openAlerts, 0),
    lowFuel: count((vehicle) => sampleFuelStatus(vehicle) === 'LOW'),
  };
}

/**
 * Story-only host of the Vehicles example: sample rows instead of GraphQL, a simulated save, and
 * `?scenario=` / `?drawer=<id|new>` for the states the stories open on. The real admin page keeps
 * the same view and drawer and replaces this class with its Apollo-backed container.
 */
@Component({
  selector: 'holita-example-vehicles-page',
  imports: [VehiclesView, VehicleDrawer],
  template: `
    <holita-vehicles-view
      [branchName]="branchName()"
      [dataAsOf]="dataAsOf"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [groups]="groups"
      [drivers]="drivers"
      [selection]="selection()"
      (stateChange)="state.set($event)"
      (create)="openEditor(null)"
      (action)="run($event)"
      (selectionChange)="selection.set($event)"
      (retry)="failed.set(false)"
    />
    @if (editor(); as editor) {
      <holita-vehicle-drawer
        [vehicle]="editor.form"
        [groups]="groups"
        [drivers]="drivers"
        [saving]="saving()"
        [saveError]="saveError()"
        [fieldErrors]="fieldErrors()"
        (save)="save($event)"
        (closed)="closeEditor()"
      />
    }
  `,
})
export class VehiclesPage {
  private readonly drawer = viewChild(VehicleDrawer);
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), [
      'loading',
      'empty',
      'error',
      'save-error',
      'deletable',
      'contract-states',
    ]),
  );
  private readonly text = computed(() => vehiclesText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  protected readonly branchName = injectBranchName();
  protected readonly dataAsOf = new Date(sampleNow).toISOString();
  protected readonly groups = sampleGroups.map((group) => ({ id: group.id, name: group.name }));
  protected readonly drivers = sampleDrivers
    .filter((driver) => driver.status !== 'INACTIVE')
    .map((driver) => ({ id: driver.id, name: driver.name }));

  protected readonly vehicles = linkedSignal<readonly SampleVehicle[]>(() =>
    this.scenario() === 'empty'
      ? []
      : this.scenario() === 'deletable'
        ? sampleVehicles.slice(0, 6).map((vehicle, index) => ({
            ...vehicle,
            id: `new-${String(index)}`,
            plate: `AA 100${String(index)} XX`,
            driverId: null,
            odometerKm: 0,
            activity: 'NO_DEVICE',
            lastReportedAt: null,
            location: null,
            speedKph: null,
            fuelPct: null,
            openAlerts: 0,
          }))
        : this.scenario() === 'contract-states'
          ? sampleVehicles.map((vehicle, index) =>
              index === 0
                ? { ...vehicle, type: 'TRAILER', fuelType: 'CNG', activity: 'ASSET' }
                : index === 1
                  ? {
                      ...vehicle,
                      type: 'OTHER',
                      fuelType: 'HYBRID',
                      fuelPct: 8,
                      lastReportedAt: new Date(sampleNow - 7 * 3_600_000).toISOString(),
                    }
                  : vehicle,
            )
          : sampleVehicles,
  );
  protected readonly state = signal<ListQuery>(
    initialQuery(
      { field: 'plate', direction: 'asc' },
      this.scenario() === 'contract-states' ? 100 : 20,
    ),
  );
  protected readonly selection = signal<readonly ListRecord<VehicleActionId>[]>([]);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  /** The open drawer: `id` null creates a vehicle. */
  protected readonly editor = linkedSignal<{ id: string | null; form: VehicleForm | null } | null>(
    () => {
      const drawer = this.query().get('drawer');
      if (drawer === 'new') return { id: null, form: null };
      const vehicle = drawer ? this.vehicles().find((item) => item.id === drawer) : undefined;
      return vehicle ? { id: vehicle.id, form: vehicleForm(vehicle) } : null;
    },
  );
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly fieldErrors = signal<Partial<Record<VehicleField, string>>>({});

  protected readonly result = computed(() =>
    runSampleList(this.vehicles(), definition, this.state()),
  );
  protected readonly rows = computed(() => this.result().items.map(vehicleRow));
  protected readonly listState = computed(() => ({ ...this.state(), page: this.result().page }));
  protected readonly kpis = computed(() =>
    this.scenario() === 'loading' || this.failed() ? null : kpisOf(this.vehicles()),
  );
  protected readonly view = computed(() =>
    sampleTableView(this.state(), this.rows().length, {
      loading: this.scenario() === 'loading',
      failed: this.failed(),
    }),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  canLeave(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    return this.drawer()?.canLeave() ?? true;
  }

  protected openEditor(id: string | null): void {
    const vehicle = id ? this.vehicles().find((item) => item.id === id) : undefined;
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.editor.set({ id: vehicle?.id ?? null, form: vehicle ? vehicleForm(vehicle) : null });
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.clearDrawer();
  }

  /** Row and bulk actions alike: the view already confirmed them and left out other records. */
  protected run({ action, ids }: ListActionRequest<VehicleActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'edit':
        if (id) this.openEditor(id);
        return;
      case 'profile':
        if (id) void this.router.navigate(['/examples/vehicles', id]);
        return;
      case 'deactivate':
        this.deactivate(ids);
        return;
      case 'delete':
        this.delete(ids);
        return;
    }
  }

  protected save(form: VehicleForm): void {
    const editor = this.editor();
    if (!editor || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      if (this.failNextSave()) {
        this.failNextSave.set(false);
        this.saveError.set(this.text().drawer.saveError);
        return;
      }
      const errors = vehicleFormErrors(this.vehicles(), editor.id, form, this.text().drawer);
      if (Object.keys(errors).length) {
        this.fieldErrors.set(errors);
        return;
      }
      this.store(editor.id, form);
      this.closeEditor();
      const template = editor.id ? this.text().notices.saved : this.text().notices.created;
      this.messages.add({
        severity: 'success',
        summary: interpolate(template, { plate: form.plate }),
      });
    }, saveDelayMs);
  }

  private store(id: string | null, form: VehicleForm): void {
    const fields = { ...form, updatedAt: new Date(sampleNow).toISOString() };
    if (id) {
      this.vehicles.update((vehicles) =>
        vehicles.map((item) => (item.id === id ? { ...item, ...fields } : item)),
      );
      return;
    }
    const created: SampleVehicle = {
      ...fields,
      id: `example-vehicle-${String(this.nextId++)}`,
      odometerKm: 0,
      activity: 'NO_DEVICE',
      speedKph: null,
      fuelPct: null,
      lastReportedAt: null,
      location: null,
      openAlerts: 0,
      createdAt: new Date(sampleNow).toISOString(),
    };
    this.vehicles.update((vehicles) => [created, ...vehicles]);
  }

  private deactivate(ids: readonly string[]): void {
    this.vehicles.update((vehicles) =>
      vehicles.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              status: 'INACTIVE',
              driverId: null,
              updatedAt: new Date(sampleNow).toISOString(),
            }
          : item,
      ),
    );
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.messages.add({
      severity: 'success',
      summary: interpolate(this.text().notices.deactivated, { count: ids.length }),
    });
  }

  private delete(ids: readonly string[]): void {
    const hasReference = (id: string) =>
      [sampleDevices, sampleTrips, sampleAlerts, sampleServiceTasks].some((records) =>
        records.some((record) => record.vehicleId === id),
      );
    const deleted = this.vehicles()
      .filter(
        (vehicle) =>
          ids.includes(vehicle.id) &&
          vehicle.lastReportedAt === null &&
          vehicle.odometerKm === 0 &&
          !hasReference(vehicle.id),
      )
      .map((vehicle) => vehicle.id);
    this.vehicles.update((vehicles) => vehicles.filter((item) => !deleted.includes(item.id)));
    this.selection.update((selection) =>
      selection.filter((record) => !deleted.includes(record.id)),
    );
    if (deleted.length)
      this.messages.add({
        severity: 'success',
        summary: interpolate(this.text().notices.deleted, { count: deleted.length }),
      });
    if (deleted.length < ids.length)
      this.messages.add({ severity: 'error', summary: this.text().notices.historyConflict });
  }
}
