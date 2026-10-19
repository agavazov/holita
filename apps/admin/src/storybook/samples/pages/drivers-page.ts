import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
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
import { fixtureBranches } from '../../session-fixtures';
import { type SampleDriver, sampleDrivers, sampleNow, sampleVehicles } from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import { injectClearDrawer, injectQueryParams, saveDelayMs, scenarioOf } from '../scenario';

const dataAsOf = new Date(sampleNow).toISOString();

function plateOf(driverId: string): string | null {
  return sampleVehicles.find((vehicle) => vehicle.driverId === driverId)?.plate ?? null;
}

const definition: SampleListDefinition<SampleDriver> = {
  search: (driver) => [driver.name, driver.employeeNo, driver.phone, driver.notes],
  columns: {
    name: (driver) => driver.name,
    status: (driver) => driver.status,
    license: (driver) => driver.licenseExpiresOn,
    tachoCard: (driver) => driver.tachoCardExpiresOn,
    score: (driver) => driver.score,
    trips: (driver) => driver.trips30d,
    distance: (driver) => driver.distance30dKm,
    hasVehicle: (driver) => plateOf(driver.id) !== null,
  },
};

function toRow(driver: SampleDriver): DriverRow {
  return { ...driver, vehiclePlate: plateOf(driver.id) };
}

function toDetails(driver: SampleDriver): DriverDetails {
  return { ...driver, vehiclePlate: plateOf(driver.id) };
}

function kpisOf(drivers: readonly SampleDriver[]): DriverKpis {
  const due = (date: string) => daysUntil(date, dataAsOf) <= documentWarningDays;
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
      [branchName]="branchName"
      [dataAsOf]="dataAsOf"
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
        [dataAsOf]="dataAsOf"
        [saving]="saving()"
        [saveError]="saveError()"
        [fieldErrors]="fieldErrors()"
        (save)="save($event)"
        (closed)="closeDrawer()"
      />
    }
  `,
})
export class DriversPage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'save-error']),
  );
  private readonly text = computed(() => driversText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  protected readonly branchName = fixtureBranches[0].name;
  protected readonly dataAsOf = dataAsOf;

  protected readonly drivers = linkedSignal<readonly SampleDriver[]>(() =>
    this.scenario() === 'empty' ? [] : sampleDrivers,
  );
  protected readonly state = signal<ListQuery>(initialQuery({ field: 'name', direction: 'asc' }));
  protected readonly selection = signal<readonly ListRecord<DriverActionId>[]>([]);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  /** The open drawer: `id` null adds a driver; `editing` opens an existing one on the form. */
  protected readonly drawer = linkedSignal<{ id: string | null; editing: boolean } | null>(() => {
    const id = this.query().get('drawer');
    if (id === 'new') return { id: null, editing: true };
    const exists = id !== null && sampleDrivers.some((driver) => driver.id === id);
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

  protected readonly result = computed(() =>
    runSampleList(this.drivers(), definition, this.state()),
  );
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
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
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
      const number = form.employeeNo.toLocaleUpperCase('en');
      const duplicate = this.drivers().some(
        (item) => item.id !== drawer.id && item.employeeNo.toLocaleUpperCase('en') === number,
      );
      if (duplicate) {
        this.fieldErrors.set({ employeeNo: this.text().drawer.duplicateEmployeeNo });
        return;
      }
      const id = this.store(drawer.id, form);
      // The mixed drawer returns to the saved record.
      this.drawer.set({ id, editing: false });
      const template = drawer.id ? this.text().notices.saved : this.text().notices.created;
      this.messages.add({
        severity: 'success',
        summary: interpolate(template, { name: form.name }),
      });
    }, saveDelayMs);
  }

  private store(id: string | null, form: DriverForm): string {
    if (id) {
      this.drivers.update((drivers) =>
        drivers.map((item) => (item.id === id ? { ...item, ...form } : item)),
      );
      return id;
    }
    const created: SampleDriver = {
      ...form,
      id: `example-driver-${String(this.nextId++)}`,
      score: null,
      trips30d: 0,
      distance30dKm: 0,
    };
    this.drivers.update((drivers) => [created, ...drivers]);
    return created.id;
  }

  private deactivate(ids: readonly string[]): void {
    this.drivers.update((drivers) =>
      drivers.map((item) => (ids.includes(item.id) ? { ...item, status: 'INACTIVE' } : item)),
    );
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.messages.add({
      severity: 'success',
      summary: interpolate(this.text().notices.deactivated, { count: ids.length }),
    });
  }

  private delete(ids: readonly string[]): void {
    this.drivers.update((drivers) => drivers.filter((item) => !ids.includes(item.id)));
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.messages.add({
      severity: 'success',
      summary: interpolate(this.text().notices.deleted, { count: ids.length }),
    });
  }
}
