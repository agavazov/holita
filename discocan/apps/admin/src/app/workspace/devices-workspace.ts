import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { FleetWorkspace } from '../features/fleet/fleet-workspace';
import { AdminWorkspace } from './admin-workspace';

@Component({
  selector: 'discocan-devices-workspace',
  imports: [FleetWorkspace, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
  template: `
    @if (query().get('hint') === 'choose-device-sms') {
      <p-message severity="info">{{ workspace.text().chooseDeviceSms }}</p-message>
    }
    <discocan-fleet-workspace />
  `,
})
export class DevicesWorkspace {
  protected readonly workspace = inject(AdminWorkspace);
  private readonly route = inject(ActivatedRoute);
  protected readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
}
