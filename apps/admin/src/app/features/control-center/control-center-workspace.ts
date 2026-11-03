import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AdminConfig } from '../../core/config/admin-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { BranchContext } from '../branches/branch-context';
import { DashboardPage } from './dashboard-page';
import { DevicePage, type DeviceTab } from './device-page';

const tabs: readonly DeviceTab[] = ['overview', 'events', 'alarms', 'commands', 'frames'];

/** One Control center scope per session, Branch and language. */
@Component({
  selector: 'holita-control-center-workspace',
  imports: [DashboardPage, DevicePage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (
      scope of scopes();
      track scope.token + ':' + scope.branchId + ':' + scope.language + ':' + scope.recordId
    ) {
      @if (scope.recordId) {
        <holita-control-center-device
          [branchId]="scope.branchId"
          [language]="scope.language"
          [recordId]="scope.recordId"
          [tab]="scope.tab"
        />
      } @else {
        <holita-control-center-dashboard [branchId]="scope.branchId" [language]="scope.language" />
      }
    }
  `,
})
export class ControlCenterWorkspace {
  private readonly workspace = inject(AdminWorkspace);
  private readonly branches = inject(BranchContext);
  private readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly scopes = computed(() => {
    const token = this.workspace.session.current()?.token;
    const id = this.params().get('branchId')?.toLowerCase();
    const branch = this.branches.branches()?.find((branch) => branch.id === id);
    const tab = tabs.find((tab) => tab === this.params().get('tab')) ?? 'overview';
    return token && branch && this.enabled
      ? [
          {
            token,
            branchId: branch.id,
            language: this.workspace.language(),
            recordId: this.params().get('recordId'),
            tab,
          },
        ]
      : [];
  });
}
