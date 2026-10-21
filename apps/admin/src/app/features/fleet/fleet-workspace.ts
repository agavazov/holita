import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Message } from 'primeng/message';
import { ButtonDirective } from 'primeng/button';
import { AdminConfig } from '../../core/config/admin-config';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { BranchContext } from '../branches/branch-context';
import { DevicesPage } from './devices/devices-list-page';
import { DeviceConfigurationPage } from './device-operations/device-configuration-page';
import { VehiclesPage } from './vehicles/vehicles-page';
import { VehicleGroupsPage } from './vehicle-groups/vehicle-groups-page';
import { AlertsPage } from './alerts/alerts-page';
import { OverviewPage } from './overview/overview-page';
import { TripsPage } from './trips/trips-page';
import { DriversPage } from './drivers/drivers-page';
import { DriverScorecardPage } from './drivers/driver-scorecard-page';
import { VehicleProfilePage } from './vehicles/vehicle-profile-page';
import { MaintenancePage } from './maintenance/maintenance-page';
import { GeneralSettingsPage } from './settings/general-settings-page';
import { GeneralSettingsApi } from './settings/general-settings-api';
import { FleetPreferences } from './settings/fleet-preferences';
import { FLEET_DISPLAY, defaultFleetDisplay } from '../../ui/format/fleet-format';
import { uiMessages } from '../../ui/i18n/messages';
import { requestError } from '../../core/graphql/request-error';
import { settingsText } from './settings/i18n/messages';

@Component({
  imports: [
    Message,
    ButtonDirective,
    DevicesPage,
    DeviceConfigurationPage,
    VehiclesPage,
    VehicleGroupsPage,
    AlertsPage,
    OverviewPage,
    TripsPage,
    DriversPage,
    DriverScorecardPage,
    VehicleProfilePage,
    MaintenancePage,
    GeneralSettingsPage,
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
  selector: 'holita-fleet-workspace',
  templateUrl: './fleet-workspace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FleetWorkspace {
  protected readonly preferences = inject(FleetPreferences);
  private readonly generalSettings = viewChild(GeneralSettingsPage);
  private readonly deviceConfiguration = viewChild(DeviceConfigurationPage);
  readonly workspace = inject(AdminWorkspace);
  private readonly branches = inject(BranchContext);
  readonly enabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly activeWorkspaces = computed(() => {
    const sessionToken = this.workspace.session.current()?.token;
    const language = this.workspace.language();
    const id = this.params().get('branchId')?.toLowerCase();
    const branch = this.branches.branches()?.find((branch) => branch.id === id);
    const editor = this.route.snapshot.data['editor'] === true;
    const resource: unknown = this.route.snapshot.data['resource'];
    const recordId = this.params().get('recordId');
    return sessionToken &&
      branch &&
      this.enabled &&
      (resource === 'vehicles' ||
        resource === 'devices' ||
        resource === 'device-configuration' ||
        resource === 'groups' ||
        resource === 'alerts' ||
        resource === 'overview' ||
        resource === 'trips' ||
        resource === 'drivers' ||
        resource === 'driver-scorecard' ||
        resource === 'vehicle-profile' ||
        resource === 'maintenance' ||
        resource === 'general')
      ? [
          {
            sessionToken,
            branch,
            language,
            editor,
            resource,
            recordId,
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
      const scope = this.activeWorkspaces()[0];
      if (scope) {
        this.preferences.initialize(scope.branch.id, scope.language);
      }
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return this.deviceConfiguration()?.canLeave() ?? this.generalSettings()?.canLeave() ?? true;
  }
}
