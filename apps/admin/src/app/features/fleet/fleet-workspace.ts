import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { AdminConfig } from '../../core/config/admin-config';
import { StoreWorkspace } from '../stores/store-workspace';
import { DevicesPage } from './devices/devices-page';
import { DeviceEditor } from './devices/device-editor';
import { VehiclesPage } from './vehicles/vehicles-page';
import { VehicleEditor } from './vehicles/vehicle-editor';

@Component({
  imports: [Message, DevicesPage, DeviceEditor, VehiclesPage, VehicleEditor],
  selector: 'holita-fleet-workspace',
  templateUrl: './fleet-workspace.html',
})
export class FleetWorkspace {
  readonly workspace = inject(StoreWorkspace);
  readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly deviceEditor = viewChild(DeviceEditor);
  private readonly vehicleEditor = viewChild(VehicleEditor);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly activeWorkspaces = computed(() => {
    const sessionToken = this.workspace.session.current()?.token;
    const language = this.workspace.language();
    const id = this.params().get('storeId')?.toLowerCase();
    const store = this.workspace.stores()?.find((store) => store.id === id);
    const editor = this.route.snapshot.data['editor'] === true;
    const resource: unknown = this.route.snapshot.data['resource'];
    const recordId = this.params().get('recordId');
    return sessionToken &&
      store &&
      this.enabled &&
      (resource === 'vehicles' || resource === 'devices')
      ? [
          {
            sessionToken,
            store,
            language,
            editor,
            resource,
            recordId,
          },
        ]
      : [];
  });

  canLeave(): boolean | Promise<boolean> {
    return (this.vehicleEditor() ?? this.deviceEditor())?.canLeave() ?? true;
  }
}
