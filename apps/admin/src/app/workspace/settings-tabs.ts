import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { AdminWorkspace } from './admin-workspace';

/** Branch settings have their own tabs; Tenant-wide Users is a separate destination. */
@Component({
  selector: 'holita-settings-tabs',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-tabs #tabs [value]="current()" (valueChange)="select($event, tabs)">
      <p-tablist [pt]="{ content: { 'aria-label': workspace.text().settings } }">
        @for (item of items(); track item.id) {
          <p-tab [value]="item.id">{{ item.label }}</p-tab>
        }
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel [value]="current()">
          <div class="app-tab-content"><ng-content /></div>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
})
export class SettingsTabs {
  readonly current = input.required<'general' | 'vehicle-groups'>();
  protected readonly workspace = inject(AdminWorkspace);
  private readonly router = inject(Router);
  protected readonly items = computed(() => {
    const text = this.workspace.text();
    const fleet = ['/', this.workspace.language(), this.workspace.branches.selectedId(), 'fleet'];
    return [
      { id: 'general', label: text.settingsGeneral, link: [...fleet, 'settings', 'general'] },
      { id: 'vehicle-groups', label: text.vehicleGroups, link: [...fleet, 'settings', 'groups'] },
    ];
  });

  protected select(value: string | number | undefined, tabs: Tabs): void {
    const item = this.items().find((item) => item.id === value);
    if (!item || item.id === this.current()) {
      return;
    }
    tabs.value.set(this.current());
    void this.router.navigate(item.link);
  }
}
