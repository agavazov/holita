import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { AdminWorkspace } from './admin-workspace';

/** Settings pages share the existing sidebar destinations and labels. */
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
  readonly current = input.required<'general' | 'vehicle-groups' | 'users'>();
  protected readonly workspace = inject(AdminWorkspace);
  private readonly router = inject(Router);
  protected readonly items = computed(
    () => this.workspace.navigation().find((group) => group.id === 'settings')?.items ?? [],
  );

  protected select(value: string | number | undefined, tabs: Tabs): void {
    const item = this.items().find((item) => item.id === value);
    if (!item || item.id === this.current()) {
      return;
    }
    tabs.value.set(this.current());
    void this.router.navigate(item.link);
  }
}
