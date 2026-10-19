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
  type DriverDetails,
  DriverDrawer,
  type DriverField,
  type DriverForm,
} from '../../../app/features/fleet/drivers/driver-drawer';
import {
  daysUntil,
  documentWarningDays,
  type DriverActionId,
  type DriverKpis,
  type DriverRow,
  DriversView,
} from '../../../app/features/fleet/drivers/drivers-view';
import { driversText } from '../../../app/features/fleet/drivers/i18n/messages';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListActionRequest, ListRecord } from '../../../app/ui/list/list-actions';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import {
  type SampleDriver,
  sampleAlerts,
  sampleNow,
  sampleTrips,
  sampleVehicles,
} from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import {
  injectBranchName,
  injectClearDrawer,
  injectQueryParams,
  saveDelayMs,
  scenarioOf,
} from '../scenario';
import { SampleDrivers } from '../sample-drivers';

const businessDate = new Date(sampleNow).toISOString().slice(0, 10);

function plateOf(driverId: string): string | null {
  return (
    sampleVehicles
      .filter((vehicle) => vehicle.driverId === driverId)
      .map((vehicle) => vehicle.plate)
      .join(', ') || null
  );
}

const definition: SampleListDefinition<SampleDriver> = {
  id: (driver) => driver.id,
  search: (driver) => [
    driver.name,
    driver.employeeNo,
    driver.identificationKey,
    driver.phone,
    driver.notes,
  ],
  columns: {
    name: (driver) => driver.name,
    lastName: (driver) => driver.lastName,
    employeeNo: (driver) => driver.employeeNo || null,
    createdAt: (driver) => driver.createdAt,
    status: (driver) => driver.status,
    license: (driver) => driver.licenseExpiresOn,
    tachoCard: (driver) => driver.tachoCardExpiresOn,
    score: (driver) => driver.score,
    trips: (driver) => driver.trips30d,
    distance: (driver) => driver.distance30dKm,
    hasVehicle: (driver) => plateOf(driver.id) !== null,
  },
  secondarySorts: {
    lastName: [{ value: (driver) => driver.firstName }],
  },
};

function toRow(driver: SampleDriver): DriverRow {
  return { ...driver, vehiclePlate: plateOf(driver.id) };
}

function toDetails(driver: SampleDriver): DriverDetails {
  return { ...driver, vehiclePlate: plateOf(driver.id) };
}

function kpisOf(drivers: readonly SampleDriver[]): DriverKpis {
  const due = (date: string | null) =>
    date !== null && daysUntil(date, businessDate) <= documentWarningDays;
  const scores = drivers.flatMap((driver) => (driver.score === null ? [] : [driver.score]));
  return {
    active: drivers.filter((driver) => driver.status === 'ACTIVE').length,
    onLeave: drivers.filter((driver) => driver.status === 'ON_LEAVE').length,
    documents: drivers.filter(
      (driver) =>
        driver.status !== 'INACTIVE' &&
        (due(driver.licenseExpiresOn) || due(driver.tachoCardExpiresOn)),
    ).length,
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    distanceKm: drivers.reduce((sum, driver) => sum + driver.distance30dKm, 0),
  };
}

/**
 * Story-only host of the Drivers example: sample rows, a simulated save, and `?scenario=` /
 * `?drawer=<id|new>` (`&edit=1` opens the form) for the states the stories open on.
 */
@Component({
  selector: 'holita-example-drivers-page',
  imports: [DriversView, DriverDrawer],
  template: `
    <holita-drivers-view
      [branchName]="branchName()"
      [businessDate]="businessDate"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [selection]="selection()"
      (stateChange)="state.set($event)"
      (create)="openDrawer(null, true)"
      (action)="run($event)"
      (selectionChange)="selection.set($event)"
      (retry)="failed.set(false)"
    />
    @if (drawer(); as open) {
      <holita-driver-drawer
        [driver]="drawerDriver()"
        [startEditing]="open.editing"
        [businessDate]="businessDate"
        [saving]="saving()"
        [saveError]="saveError()"
        [fieldErrors]="fieldErrors()"
        (save)="save($event)"
        (closed)="closeDrawer()"
        (openScorecard)="openScorecard(open.id)"
      />
    }
  `,
})
export class DriversPage {
  private readonly router = inject(Router);
  private readonly samples = inject(SampleDrivers);
  private readonly driverDrawer = viewChild(DriverDrawer);
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'save-error']),
  );
  private readonly text = computed(() => driversText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly branchName = injectBranchName();
  protected readonly businessDate = businessDate;

  protected readonly drivers = this.samples.rows;
  protected readonly state = signal<ListQuery>(initialQuery({ field: 'name', direction: 'asc' }));
  protected readonly selection = signal<readonly ListRecord<DriverActionId>[]>([]);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  /** The open drawer: `id` null adds a driver; `editing` opens an existing one on the form. */
  protected readonly drawer = linkedSignal<{ id: string | null; editing: boolean } | null>(() => {
    const id = this.query().get('drawer');
    if (id === 'new') return { id: null, editing: true };
    const exists = id !== null && this.drivers().some((driver) => driver.id === id);
    return exists ? { id, editing: this.query().get('edit') === '1' } : null;
  });
  protected readonly drawerDriver = computed(() => {
    const id = this.drawer()?.id;
    const driver = id ? this.drivers().find((item) => item.id === id) : undefined;
    return driver ? toDetails(driver) : null;
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly fieldErrors = signal<Partial<Record<DriverField, string>>>({});

  protected readonly result = computed(() => {
    const state = this.state();
    const categories = state.conditions.filter(
      (condition) => condition.field === 'licenseCategories',
    );
    const drivers = this.drivers().filter((driver) =>
      categories.every((condition) =>
        condition.values.some((value) =>
          driver.licenseCategories.some((category) => category === value),
        ),
      ),
    );
    return runSampleList(drivers, definition, {
      ...state,
      conditions: state.conditions.filter((condition) => condition.field !== 'licenseCategories'),
    });
  });
  protected readonly rows = computed(() => this.result().items.map(toRow));
  protected readonly listState = computed(() => ({ ...this.state(), page: this.result().page }));
  protected readonly kpis = computed(() =>
    this.scenario() === 'loading' || this.failed() ? null : kpisOf(this.drivers()),
  );
  protected readonly view = computed(() =>
    sampleTableView(this.state(), this.rows().length, {
      loading: this.scenario() === 'loading',
      failed: this.failed(),
    }),
  );

  constructor() {
    if (this.scenario() === 'empty') this.drivers.set([]);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  canLeave(): Promise<boolean> | boolean {
    return this.driverDrawer()?.canLeave() ?? true;
  }

  protected openDrawer(id: string | null, editing: boolean): void {
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.drawer.set({ id, editing });
  }

  protected closeDrawer(): void {
    this.drawer.set(null);
    this.clearDrawer();
  }

  /** Row and bulk actions alike: the view already confirmed them and left out other records. */
  protected run({ action, ids }: ListActionRequest<DriverActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'view':
        if (id) this.openDrawer(id, false);
        return;
      case 'edit':
        if (id) this.openDrawer(id, true);
        return;
      case 'scorecard':
        if (id) this.openScorecard(id);
        return;
      case 'deactivate':
        this.deactivate(ids);
        return;
      case 'delete':
        this.delete(ids);
        return;
    }
  }

  protected save(form: DriverForm): void {
    const drawer = this.drawer();
    if (!drawer || this.saving()) return;
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
      const number = form.employeeNo;
      const duplicate = this.drivers().some(
        (item) => item.id !== drawer.id && number !== '' && item.employeeNo === number,
      );
      if (duplicate) {
        this.fieldErrors.set({ employeeNo: this.text().drawer.duplicateEmployeeNo });
        return;
      }
      if (
        form.identificationKey &&
        this.drivers().some(
          (driver) =>
            driver.id !== drawer.id && driver.identificationKey === form.identificationKey,
        )
      ) {
        this.fieldErrors.set({ identificationKey: this.text().drawer.duplicateIdentificationKey });
        return;
      }
      if (drawer.id && form.status === 'INACTIVE' && plateOf(drawer.id) !== null) {
        this.fieldErrors.set({ status: this.text().drawer.assignedDriver });
        return;
      }
      const id = this.store(drawer.id, form);
      // The mixed drawer returns to the saved record.
      this.drawer.set({ id, editing: false });
      const template = drawer.id ? this.text().notices.saved : this.text().notices.created;
      this.messages.add({
        severity: 'success',
        summary: interpolate(template, { name: `${form.firstName} ${form.lastName}` }),
      });
    }, saveDelayMs);
  }

  protected openScorecard(id: string | null): void {
    if (id) void this.router.navigate(['/examples/drivers', id, 'scorecard']);
  }

  private store(id: string | null, form: DriverForm): string {
    if (id) {
      this.drivers.update((drivers) =>
        drivers.map((item) =>
          item.id === id
            ? {
                ...item,
                ...form,
                name: `${form.firstName} ${form.lastName}`,
                updatedAt: new Date(sampleNow).toISOString(),
              }
            : item,
        ),
      );
      return id;
    }
    const created: SampleDriver = {
      ...form,
      name: `${form.firstName} ${form.lastName}`,
      id: this.samples.createId(),
      createdAt: new Date(sampleNow).toISOString(),
      updatedAt: new Date(sampleNow).toISOString(),
      score: null,
      trips30d: 0,
      distance30dKm: 0,
    };
    this.drivers.update((drivers) => [created, ...drivers]);
    return created.id;
  }

  private deactivate(ids: readonly string[]): void {
    const changed = ids.filter((id) => plateOf(id) === null);
    const failed = ids.length - changed.length;
    this.drivers.update((drivers) =>
      drivers.map((item) =>
        changed.includes(item.id)
          ? { ...item, status: 'INACTIVE', updatedAt: new Date(sampleNow).toISOString() }
          : item,
      ),
    );
    this.selection.update((selection) =>
      selection.filter((record) => !changed.includes(record.id)),
    );
    if (changed.length && !failed)
      this.messages.add({
        severity: 'success',
        summary: interpolate(this.text().notices.deactivated, { count: changed.length }),
      });
    if (failed)
      this.messages.add({
        severity: 'warn',
        sticky: true,
        summary: changed.length
          ? interpolate(this.text().notices.deactivatedPartial, { changed: changed.length, failed })
          : interpolate(this.text().notices.assigned, { count: failed }),
      });
  }

  private delete(ids: readonly string[]): void {
    const changed = ids.filter(
      (id) =>
        plateOf(id) === null &&
        !this.drivers().some((driver) => driver.id === id && driver.trips30d > 0) &&
        !sampleTrips.some((trip) => trip.driverId === id) &&
        !sampleAlerts.some((alert) => alert.driverId === id),
    );
    const failed = ids.length - changed.length;
    this.drivers.update((drivers) => drivers.filter((item) => !changed.includes(item.id)));
    this.selection.update((selection) =>
      selection.filter((record) => !changed.includes(record.id)),
    );
    if (changed.length && !failed)
      this.messages.add({
        severity: 'success',
        summary: interpolate(this.text().notices.deleted, { count: changed.length }),
      });
    if (failed)
      this.messages.add({
        severity: 'warn',
        sticky: true,
        summary: changed.length
          ? interpolate(this.text().notices.deletedPartial, { changed: changed.length, failed })
          : interpolate(this.text().notices.protected, { count: failed }),
      });
  }
}
