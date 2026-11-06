import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { AdminConfig } from '../../core/config/admin-config';
import { requestError } from '../../core/graphql/request-error';
import { FLEET_DISPLAY, defaultFleetDisplay } from '../../ui/format/fleet-format';
import { uiMessages } from '../../ui/i18n/messages';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { BranchContext } from '../branches/branch-context';
import { FleetPreferences } from '../fleet/settings/fleet-preferences';
import { GeneralSettingsApi } from '../fleet/settings/general-settings-api';
import { settingsText } from '../fleet/settings/i18n/messages';
import { DashboardPage } from './dashboard-page';
import { DevicePage, deviceTabs } from './device-page';

/**
 * One Control center scope per session, Branch and language; the route reuse strategy creates a
 * fresh workspace for another scope, so its Fleet settings give the Branch's time zone and units.
 */
@Component({
  selector: 'holita-control-center-workspace',
  imports: [ButtonDirective, Message, DashboardPage, DevicePage],
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
  template: `
    @if (!enabled) {
      <section class="app-card">
        <h1>{{ workspace.text().controlCenter }}</h1>
        <p-message severity="warn">{{ workspace.text().fleetDisabled }}</p-message>
      </section>
    } @else {
      @for (
        scope of scopes();
        track scope.token + ':' + scope.branchId + ':' + scope.language + ':' + scope.recordId
      ) {
        @if (!preferences.settings()) {
          <section class="app-card">
            <h1>{{ workspace.text().controlCenter }}</h1>
            @if (preferences.loading()) {
              <p role="status">{{ uiText().loading }}</p>
            } @else {
              <p-message severity="error" role="alert">{{ preferencesError() }}</p-message>
              <button pButton type="button" (click)="preferences.retry()">
                {{ uiText().retry }}
              </button>
            }
          </section>
        } @else if (scope.recordId) {
          <holita-control-center-device
            [branchId]="scope.branchId"
            [language]="scope.language"
            [recordId]="scope.recordId"
            [tab]="scope.tab"
          />
        } @else {
          <holita-control-center-dashboard
            [branchId]="scope.branchId"
            [language]="scope.language"
          />
        }
      } @empty {
        <section class="app-card">
          <p-message severity="error">{{ workspace.text().unavailableBranch }}</p-message>
        </section>
      }
    }
  `,
})
export class ControlCenterWorkspace {
  protected readonly workspace = inject(AdminWorkspace);
  protected readonly preferences = inject(FleetPreferences);
  private readonly branches = inject(BranchContext);
  protected readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly scopes = computed(() => {
    const token = this.workspace.session.current()?.token;
    const id = this.params().get('branchId')?.toLowerCase();
    const branch = this.branches.branches()?.find((branch) => branch.id === id);
    const routeTab = this.params().get('tab');
    const canonicalTab =
      routeTab === 'alarms' ? 'problems' : routeTab === 'sms' ? 'sms-commands' : routeTab;
    const tab = deviceTabs.find((tab) => tab === canonicalTab) ?? 'overview';
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
        this.preferences.initialize(scope.branchId, scope.language);
      }
    });
  }
}
