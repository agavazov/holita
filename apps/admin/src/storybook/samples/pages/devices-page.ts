import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DeviceDrawer,
  type DeviceField,
  type DeviceForm,
} from '../../../app/features/fleet/devices/device-drawer';
import {
  currentFirmware,
  type DeviceKpis,
  type DeviceRow,
  DevicesView,
} from '../../../app/features/fleet/devices/devices-view';
import { devicesText } from '../../../app/features/fleet/devices/i18n/messages';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListQuery } from '../../../app/ui/list/list-query';
import type { TableNotice } from '../../../app/ui/table-panel/table-panel';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import { fixtureBranches } from '../../session-fixtures';
import {
  type SampleDevice,
  sampleDevices,
  sampleNow,
  sampleVehicles,
  vehicleById,
} from '../fleet-samples';
import {
  initialQuery,
  runSampleList,
  type SampleListDefinition,
  sampleTableView,
} from '../sample-list';
import { injectQueryParams, saveDelayMs, scenarioOf } from '../scenario';

const dataAsOf = new Date(sampleNow).toISOString();
const models = [...new Set(sampleDevices.map((device) => device.model))].sort();

const definition: SampleListDefinition<SampleDevice> = {
  search: (device) => [
    device.imei,
    device.simIccid,
    device.model,
    device.vehicleId ? (vehicleById(device.vehicleId)?.plate ?? null) : null,
  ],
  columns: {
    imei: (device) => device.imei,
    status: (device) => device.status,
    vehicle: (device) => (device.vehicleId ? (vehicleById(device.vehicleId)?.plate ?? null) : null),
    lastSeenAt: (device) => device.lastSeenAt,
    model: (device) => device.model,
    firmware: (device) => device.firmware,
    installed: (device) => device.vehicleId !== null,
  },
};

function toRow(device: SampleDevice): DeviceRow {
  return {
    ...device,
    plate: device.vehicleId ? (vehicleById(device.vehicleId)?.plate ?? null) : null,
  };
}

function kpisOf(devices: readonly SampleDevice[]): DeviceKpis {
  return {
    online: devices.filter((device) => device.status === 'ONLINE').length,
    offline: devices.filter((device) => device.status === 'OFFLINE').length,
    stock: devices.filter((device) => device.status === 'IN_STOCK').length,
    outdated: devices.filter((device) => device.firmware !== currentFirmware).length,
  };
}

/**
 * Story-only host of the Devices example: sample trackers, a simulated save and restart, and
 * `?scenario=` / `?drawer=<id|new>` for the stories' states.
 */
@Component({
  selector: 'holita-example-devices-page',
  imports: [DevicesView, DeviceDrawer],
  template: `
    <holita-devices-view
      [branchName]="branchName"
      [dataAsOf]="dataAsOf"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [models]="models"
      [selection]="selection()"
      [notice]="notice()"
      (stateChange)="state.set($event)"
      (create)="openEditor(null)"
      (edit)="openEditor($event)"
      (rowAction)="rowAction($event.action, $event.id)"
      (selectionChange)="selection.set($event)"
      (bulkAction)="restart(selection())"
      (retry)="failed.set(false)"
      (dismissNotice)="notice.set(null)"
    />
    @if (editor(); as open) {
      <holita-device-drawer
        [device]="open.device"
        [models]="models"
        [vehicles]="vehicles"
        [dataAsOf]="dataAsOf"
        [saving]="saving()"
        [saveError]="saveError()"
        [fieldErrors]="fieldErrors()"
        (save)="save($event)"
        (closed)="editor.set(null)"
      />
    }
  `,
})
export class DevicesPage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'save-error']),
  );
  private readonly text = computed(() => devicesText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  protected readonly branchName = fixtureBranches[0].name;
  protected readonly dataAsOf = dataAsOf;
  protected readonly models = models;
  protected readonly vehicles = sampleVehicles.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.plate,
  }));
  protected readonly devices = linkedSignal<readonly SampleDevice[]>(() =>
    this.scenario() === 'empty' ? [] : sampleDevices,
  );
  protected readonly state = signal<ListQuery>(initialQuery({ field: 'imei', direction: 'asc' }));
  protected readonly selection = signal<readonly string[]>([]);
  protected readonly notice = signal<TableNotice | null>(null);
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  /** The open drawer: `device` null registers a new one. */
  protected readonly editor = linkedSignal<{ device: DeviceRow | null } | null>(() => {
    const drawer = this.query().get('drawer');
    if (drawer === 'new') return { device: null };
    const device = drawer ? sampleDevices.find((item) => item.id === drawer) : undefined;
    return device ? { device: toRow(device) } : null;
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly fieldErrors = signal<Partial<Record<DeviceField, string>>>({});

  protected readonly result = computed(() =>
    runSampleList(this.devices(), definition, this.state()),
  );
  protected readonly rows = computed(() => this.result().items.map(toRow));
  protected readonly listState = computed(() => ({ ...this.state(), page: this.result().page }));
  protected readonly kpis = computed(() =>
    this.scenario() === 'loading' || this.failed() ? null : kpisOf(this.devices()),
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

  protected openEditor(id: string | null): void {
    const device = id ? this.devices().find((item) => item.id === id) : undefined;
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.editor.set({ device: device ? toRow(device) : null });
  }

  protected rowAction(action: string, id: string): void {
    const device = this.devices().find((item) => item.id === id);
    if (!device) return;
    if (action === 'edit') this.openEditor(id);
    if (action === 'restart') this.restart([id]);
    if (action === 'vehicle' && device.vehicleId)
      void this.router.navigate(['/examples/vehicles', device.vehicleId]);
  }

  protected restart(ids: readonly string[]): void {
    const online = this.devices().filter(
      (device) => ids.includes(device.id) && device.status === 'ONLINE',
    );
    this.selection.set([]);
    this.notice.set({
      severity: online.length ? 'success' : 'warn',
      text: interpolate(this.text().notices.restarted, { count: online.length }),
    });
  }

  protected save(form: DeviceForm): void {
    const editor = this.editor();
    if (!editor || this.saving()) return;
    const id = editor.device?.id ?? null;
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
      if (this.devices().some((item) => item.id !== id && item.imei === form.imei)) {
        this.fieldErrors.set({ imei: this.text().drawer.duplicateImei });
        return;
      }
      this.devices.update((devices) =>
        id
          ? devices.map((item) => (item.id === id ? { ...item, ...form } : item))
          : [
              {
                ...form,
                id: `example-device-${String(this.nextId++)}`,
                firmware: currentFirmware,
                status: 'IN_STOCK',
                lastSeenAt: null,
                signal: null,
                voltage: null,
                installedOn: null,
              },
              ...devices,
            ],
      );
      this.editor.set(null);
      const template = id ? this.text().notices.saved : this.text().notices.created;
      this.notice.set({ severity: 'success', text: interpolate(template, { imei: form.imei }) });
    }, saveDelayMs);
  }
}
