import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { AdminConfig } from '../../../core/config/admin-config';
import { BranchContext } from '../../branches/branch-context';
import { MonitoringPage } from './monitoring-page';
import { MonitoringSettings } from './monitoring-settings';
import { monitoringText } from './monitoring-text';

@Component({
  selector: 'holita-karma-monitoring-workspace',
  imports: [MonitoringPage, MonitoringSettings, Message],
  template: `
    @for (scope of scopes(); track scope.key) {
      @if (scope.section === 'settings') {
        <holita-karma-monitoring-settings
          [branchId]="scope.branchId"
          [branchName]="scope.branchName"
          [language]="scope.language"
        />
      } @else {
        <holita-karma-monitoring-page
          [branchId]="scope.branchId"
          [branchName]="scope.branchName"
          [language]="scope.language"
          [section]="scope.section"
        />
      }
    } @empty {
      <section class="app-card">
        <p-message severity="warn">{{ text().unavailable }}</p-message>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringWorkspace {
  private readonly workspace = inject(AdminWorkspace);
  private readonly branches = inject(BranchContext);
  private readonly config = inject(AdminConfig);
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly settings = viewChild(MonitoringSettings);
  protected readonly text = computed(() => monitoringText(this.workspace.language()));
  protected readonly scopes = computed(() => {
    const language = this.workspace.language();
    const token = this.workspace.session.current()?.token;
    const branchId = this.branches.selectedId();
    const branch = this.branches.branches()?.find((item) => item.id === branchId);
    const section: unknown = this.data()['section'];
    return token &&
      branch &&
      this.config.fleetEnabled &&
      (section === 'trucks' || section === 'faults' || section === 'log' || section === 'settings')
      ? [
          {
            branchId: branch.id,
            branchName: branch.name,
            language,
            section,
            key: `${token}/${branch.id}/${language}/${section}`,
          },
        ]
      : [];
  });
  canLeave(): boolean | Promise<boolean> {
    return this.settings()?.canLeave() ?? true;
  }
}
