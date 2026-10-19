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
  DeviceDrawer,
  type DeviceField,
  type DeviceForm,
} from '../../../app/features/fleet/devices/device-drawer';
import {
  currentFirmware,
  type DeviceActionId,
  type DeviceKpis,
  type DeviceRow,
  DevicesView,
} from '../../../app/features/fleet/devices/devices-view';
import { devicesText } from '../../../app/features/fleet/devices/i18n/messages';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListActionRequest, ListRecord } from '../../../app/ui/list/list-actions';
import type { ListQuery } from '../../../app/ui/list/list-query';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
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
import {
  injectBranchName,
  injectClearDrawer,
  injectQueryParams,
  saveDelayMs,
  scenarioOf,
} from '../scenario';

const dataAsOf = new Date(sampleNow).toISOString();
const models = [...new Set(sampleDevices.map((device) => device.model))].sort();
interface SampleDeviceRecord extends SampleDevice {
  readonly createdAt: string;
}
const initialDevices: readonly SampleDeviceRecord[] = sampleDevices.map((device) => ({
  ...device,
  createdAt: new Date(
    device.installedOn
      ? Date.parse(`${device.installedOn}T00:00:00.000Z`) - 86_400_000
      : sampleNow - Number(device.id.replace(/\D/g, '')) * 86_400_000,
  ).toISOString(),
}));

const definition: SampleListDefinition<SampleDeviceRecord> = {
  id: (device) => device.id,
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
    installedAt: (device) => device.installedOn,
    createdAt: (device) => device.createdAt,
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
      [demo]="true"
      [branchName]="branchName()"
      [dataAsOf]="dataAsOf"
      [rows]="rows()"
      [total]="result().total"
      [view]="view()"
      [state]="listState()"
      [kpis]="kpis()"
      [models]="models"
      [selection]="selection()"
      (stateChange)="state.set($event)"
      (create)="openEditor(null)"
      (action)="run($event)"
      (selectionChange)="selection.set($event)"
      (retry)="failed.set(false)"
    />
    @if (editor(); as open) {
      <holita-device-drawer
        [demo]="true"
        [device]="open.device"
        [models]="models"
        [vehicles]="vehicles"
        [dataAsOf]="dataAsOf"
        [saving]="saving()"
        [saveError]="saveError()"
        [fieldErrors]="fieldErrors()"
        (save)="save($event)"
        (closed)="closeEditor()"
      />
    }
  `,
})
export class DevicesPage {
  private readonly drawer = viewChild(DeviceDrawer);
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error', 'save-error']),
  );
  private readonly text = computed(() => devicesText(this.language()));
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  protected readonly branchName = injectBranchName();
  protected readonly dataAsOf = dataAsOf;
  protected readonly models = models;
  protected readonly vehicles = sampleVehicles.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.plate,
  }));
  protected readonly devices = linkedSignal<readonly SampleDeviceRecord[]>(() =>
    this.scenario() === 'empty' ? [] : initialDevices,
  );
  protected readonly state = signal<ListQuery>(initialQuery({ field: 'imei', direction: 'asc' }));
  protected readonly selection = signal<readonly ListRecord<DeviceActionId>[]>([]);
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

  canLeave(): boolean | Promise<boolean> {
    return this.drawer()?.canLeave() ?? true;
  }

  protected openEditor(id: string | null): void {
    const device = id ? this.devices().find((item) => item.id === id) : undefined;
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.editor.set({ device: device ? toRow(device) : null });
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.clearDrawer();
  }

  /** Row and bulk actions alike: the view already confirmed them and left out other records. */
  protected run({ action, ids }: ListActionRequest<DeviceActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'edit':
        if (id) this.openEditor(id);
        return;
      case 'restart':
        this.restart(ids);
        return;
      case 'vehicle':
        if (id) this.openVehicle(id);
        return;
    }
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
      const status: SampleDevice['status'] = form.vehicleId === null ? 'IN_STOCK' : 'OFFLINE';
      this.devices.update((devices) =>
        id
          ? devices.map((item) =>
              item.id !== id
                ? item
                : item.vehicleId === form.vehicleId
                  ? { ...item, ...form }
                  : {
                      ...item,
                      ...form,
                      status,
                      lastSeenAt: null,
                      signal: null,
                      voltage: null,
                      installedOn: null,
                    },
            )
          : [
              {
                ...form,
                id: `example-device-${String(this.nextId++)}`,
                firmware: currentFirmware,
                status,
                lastSeenAt: null,
                signal: null,
                voltage: null,
                installedOn: null,
                createdAt: dataAsOf,
              },
              ...devices,
            ],
      );
      this.closeEditor();
      const template = id ? this.text().notices.saved : this.text().notices.created;
      this.messages.add({
        severity: 'success',
        summary: interpolate(template, { imei: form.imei }),
      });
    }, saveDelayMs);
  }

  /** A simulated restart: the devices keep reporting afterwards, so no row changes. */
  private restart(ids: readonly string[]): void {
    this.selection.update((selection) => selection.filter((record) => !ids.includes(record.id)));
    this.messages.add({
      severity: 'success',
      summary: interpolate(this.text().notices.restarted, { count: ids.length }),
    });
  }

  private openVehicle(id: string): void {
    const vehicleId = this.devices().find((item) => item.id === id)?.vehicleId;
    if (vehicleId) void this.router.navigate(['/examples/vehicles', vehicleId]);
  }
}
