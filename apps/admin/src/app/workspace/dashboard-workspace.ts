import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { ControlCenterWorkspace } from '../features/control-center/control-center-workspace';
import { FleetWorkspace } from '../features/fleet/fleet-workspace';
import { AdminWorkspace } from './admin-workspace';

/** Keep the existing list/drawer route context until the dashboard package replaces these screens. */
@Component({
  selector: 'holita-dashboard-workspace',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, ControlCenterWorkspace, FleetWorkspace],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
  template: `
    <p-tabs [value]="tab" (valueChange)="selectTab($event)">
      <p-tablist [attr.aria-label]="workspace.text().dashboard">
        <p-tab value="overview">{{ workspace.text().overview }}</p-tab>
        <p-tab value="problems">{{ workspace.text().problems }}</p-tab>
        <p-tab value="trips">{{ workspace.text().trips }}</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel [value]="tab">
          <div class="app-view">
            <p class="app-muted">{{ hint() }}</p>
            @if (tab === 'overview') {
              <holita-control-center-workspace />
            } @else {
              <holita-fleet-workspace />
            }
          </div>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
})
export class DashboardWorkspace {
  protected readonly workspace = inject(AdminWorkspace);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly tab =
    ['overview', 'problems', 'trips'].find(
      (tab) => tab === this.route.snapshot.data['dashboardTab'],
    ) ?? 'overview';
  protected readonly hint = computed(() => {
    const text = this.workspace.text();
    return this.tab === 'problems'
      ? text.dashboardProblemsHint
      : this.tab === 'trips'
        ? text.dashboardTripsHint
        : text.dashboardOverviewHint;
  });

  protected selectTab(value: string | number | undefined): void {
    if (value === 'overview' || value === 'problems' || value === 'trips') {
      void this.router.navigate([
        '/',
        this.workspace.language(),
        this.route.snapshot.paramMap.get('branchId'),
        'fleet',
        'dashboard',
        value,
      ]);
    }
  }
}
