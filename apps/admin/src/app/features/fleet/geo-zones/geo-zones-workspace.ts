import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { AdminConfig } from '../../../core/config/admin-config';
import { FLEET_DISPLAY, defaultFleetDisplay } from '../../../ui/format/fleet-format';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { BranchContext } from '../../branches/branch-context';
import { FleetPreferences } from '../settings/fleet-preferences';
import { GeneralSettingsApi } from '../settings/general-settings-api';
import { GeoZonesPage } from './geo-zones-page';
import { geoZonesText } from './geo-zones-text';

/** The geo-zones page with its Branch display preferences (time zone and date format). */
@Component({
  selector: 'discocan-geo-zones-workspace',
  imports: [Message, GeoZonesPage],
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
        <h1 id="page-title">{{ title() }}</h1>
        <p-message severity="warn">{{ workspace.text().fleetDisabled }}</p-message>
      </section>
    } @else {
      @for (scope of scopes(); track scope.token + ':' + scope.branch.id + ':' + scope.language) {
        <discocan-geo-zones-page [branchId]="scope.branch.id" [language]="scope.language" />
      } @empty {
        <p-message severity="error">{{ workspace.text().unavailableBranch }}</p-message>
      }
    }
  `,
})
export class GeoZonesWorkspace {
  protected readonly workspace = inject(AdminWorkspace);
  protected readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly preferences = inject(FleetPreferences);
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
  protected readonly title = computed(() => geoZonesText(this.workspace.language()).title);

  constructor() {
    effect(() => {
      const scope = this.scopes()[0];
      if (scope) {
        this.preferences.initialize(scope.branch.id, scope.language);
      }
    });
  }
}
