import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { AdminConfig } from '../core/config/admin-config';
import { requestError } from '../core/graphql/request-error';
import { BranchContext } from '../features/branches/branch-context';
import { OverviewPage } from '../features/fleet/overview/overview-page';
import { ProblemsPage } from '../features/fleet/overview/problems-page';
import { FleetPreferences } from '../features/fleet/settings/fleet-preferences';
import { GeneralSettingsApi } from '../features/fleet/settings/general-settings-api';
import { settingsText } from '../features/fleet/settings/i18n/messages';
import { TripsPage } from '../features/fleet/trips/trips-page';
import { FLEET_DISPLAY, defaultFleetDisplay } from '../ui/format/fleet-format';
import { uiMessages } from '../ui/i18n/messages';
import { AdminWorkspace } from './admin-workspace';
import { PageLoading } from './page-loading';

/** Each mounted dashboard owns its Branch preferences and feature clients. */
@Component({
  selector: 'holita-dashboard-workspace',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    ButtonDirective,
    Message,
    OverviewPage,
    ProblemsPage,
    TripsPage,
    PageLoading,
  ],
  providers: [
    GeneralSettingsApi,
    FleetPreferences,
    {
      provide: FLEET_DISPLAY,
      useFactory: () => {
        const preferences = inject(FleetPreferences);
        return computed(() => preferences.settings() ?? defaultFleetDisplay);
      },
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
  template: `
    @if (!enabled) {
      <section class="app-card">
        <h1 id="page-title">{{ workspace.text().dashboard }}</h1>
        <p-message severity="warn">{{ workspace.text().fleetDisabled }}</p-message>
      </section>
    } @else {
      @for (scope of scopes(); track scope.token + ':' + scope.branch.id + ':' + scope.language) {
        @if (!preferences.settings()) {
          @if (preferences.loading()) {
            <holita-page-loading />
          } @else {
            <section class="app-card">
              <p-message severity="error">{{ preferencesError() }}</p-message>
              <button pButton type="button" (click)="preferences.retry()">
                {{ uiText().retry }}
              </button>
            </section>
          }
        } @else {
          <p-tabs [value]="tab" (valueChange)="selectTab($event)">
            <p-tablist [pt]="{ content: { 'aria-label': workspace.text().dashboard } }">
              <p-tab value="overview">{{ workspace.text().overview }}</p-tab>
              <p-tab value="problems">{{ workspace.text().problems }}</p-tab>
              <p-tab value="trips">{{ workspace.text().trips }}</p-tab>
            </p-tablist>
            <p-tabpanels>
              <p-tabpanel [value]="tab">
                <div class="app-view">
                  @switch (tab) {
                    @case ('overview') {
                      <holita-overview-page [branch]="scope.branch" [language]="scope.language" />
                    }
                    @case ('problems') {
                      <holita-problems-page [branch]="scope.branch" [language]="scope.language" />
                    }
                    @case ('trips') {
                      <holita-trips-page [branch]="scope.branch" [language]="scope.language" />
                    }
                  }
                </div>
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        }
      } @empty {
        <p-message severity="error">{{ workspace.text().unavailableBranch }}</p-message>
      }
    }
  `,
})
export class DashboardWorkspace {
  protected readonly workspace = inject(AdminWorkspace);
  protected readonly preferences = inject(FleetPreferences);
  protected readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly branches = inject(BranchContext);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly scopes = computed(() => {
    const token = this.workspace.session.current()?.token;
    const id = this.params().get('branchId')?.toLowerCase();
    const branch = this.branches.branches()?.find((branch) => branch.id === id);
    return token && branch && this.enabled
      ? [{ token, branch, language: this.workspace.language() }]
      : [];
  });
  protected readonly tab =
    ['overview', 'problems', 'trips'].find(
      (tab) => tab === this.route.snapshot.data['dashboardTab'],
    ) ?? 'overview';
  protected readonly uiText = computed(() => uiMessages[this.workspace.language()]);
  protected readonly preferencesError = computed(() =>
    requestError(
      this.preferences.error(),
      settingsText(this.workspace.language()).general.loadError,
    ),
  );

  constructor() {
    effect(() => {
      const scope = this.scopes()[0];
      if (scope) {
        this.preferences.initialize(scope.branch.id, scope.language);
      }
    });
  }

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
