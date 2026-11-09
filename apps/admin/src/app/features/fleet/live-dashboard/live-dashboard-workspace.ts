import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { AdminConfig } from '../../../core/config/admin-config';
import { requestError } from '../../../core/graphql/request-error';
import { uiMessages } from '../../../ui/i18n/messages';
import { FLEET_DISPLAY, defaultFleetDisplay } from '../../../ui/format/fleet-format';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { PageLoading } from '../../../workspace/page-loading';
import { BranchContext } from '../../branches/branch-context';
import { FleetPreferences } from '../settings/fleet-preferences';
import { GeneralSettingsApi } from '../settings/general-settings-api';
import { settingsText } from '../settings/i18n/messages';
import { LiveDashboardPage } from './live-dashboard-page';
import { liveDashboardText } from './live-dashboard-text';

/** The truck dashboard owns its Branch preferences (units, time zone, speed limit) and client. */
@Component({
  selector: 'discocan-live-dashboard-workspace',
  imports: [ButtonDirective, Message, PageLoading, LiveDashboardPage],
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
  host: { class: 'app-view app-view--bleed' },
  template: `
    @if (!enabled) {
      <section class="app-card">
        <h1 id="page-title">{{ title() }}</h1>
        <p-message severity="warn">{{ workspace.text().fleetDisabled }}</p-message>
      </section>
    } @else {
      @for (scope of scopes(); track scope.token + ':' + scope.branch.id + ':' + scope.language) {
        @if (!preferences.settings()) {
          @if (preferences.loading()) {
            <discocan-page-loading />
          } @else {
            <section class="app-card">
              <p-message severity="error">{{ preferencesError() }}</p-message>
              <button pButton type="button" (click)="preferences.retry()">
                {{ uiText().retry }}
              </button>
            </section>
          }
        } @else {
          <discocan-live-dashboard-page [branch]="scope.branch" [language]="scope.language" />
        }
      } @empty {
        <p-message severity="error">{{ workspace.text().unavailableBranch }}</p-message>
      }
    }
  `,
})
export class LiveDashboardWorkspace {
  protected readonly workspace = inject(AdminWorkspace);
  protected readonly preferences = inject(FleetPreferences);
  protected readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly branches = inject(BranchContext);
  private readonly route = inject(ActivatedRoute);
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
  protected readonly title = computed(() => liveDashboardText(this.workspace.language()).title);
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
}
