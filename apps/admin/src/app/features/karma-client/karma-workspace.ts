import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { KarmaAdministration } from './administration/karma-administration';
import { CarsPage } from './cars/cars-page/cars-page';
import { CarDetails } from './cars/car-details/car-details';
import { LocationPage } from './location/location-page/location-page';
import { TripsPage } from './history/trips-page/trips-page';
import { EventsPage } from './history/events-page/events-page';
import { DrivingProfilePage } from './history/driving-profile-page/driving-profile-page';
import { DeviceManagementPage } from './device-management/device-management-page';
import { EdataPage } from './edata/edata-page/edata-page';
import { KarmaDiagnosticsPage } from './diagnostics/karma-diagnostics-page';

@Component({
  selector: 'holita-karma-workspace',
  imports: [
    DeviceManagementPage,
    KarmaAdministration,
    CarsPage,
    CarDetails,
    EdataPage,
    TripsPage,
    EventsPage,
    DrivingProfilePage,
    LocationPage,
    KarmaDiagnosticsPage,
  ],
  template: `
    @for (
      scope of scopes();
      track scope.token +
        ':' +
        scope.language +
        ':' +
        scope.id +
        ':' +
        scope.edata +
        ':' +
        scope.section
    ) {
      @if (scope.section === 'diagnostics' && scope.id !== null) {
        <holita-karma-diagnostics-page [language]="scope.language" [carId]="scope.id" />
      } @else if (scope.section === 'configuration' && scope.id !== null) {
        <holita-device-management-page [language]="scope.language" [carId]="scope.id" />
      } @else if (scope.administration) {
        <holita-karma-administration [language]="scope.language" [section]="scope.section" />
      } @else if (scope.section === 'location' && scope.id !== null) {
        <holita-location-page [language]="scope.language" [carId]="scope.id" />
      } @else if (scope.section === 'trips' && scope.id !== null) {
        <holita-trips-page [language]="scope.language" [carId]="scope.id" />
      } @else if (scope.section === 'events' && scope.id !== null) {
        <holita-events-page [language]="scope.language" [carId]="scope.id" />
      } @else if (scope.section === 'driving-profile' && scope.id !== null) {
        <holita-driving-profile-page [language]="scope.language" [carId]="scope.id" />
      } @else if (scope.edata && scope.id !== null) {
        <holita-edata-page [language]="scope.language" [carId]="scope.id" />
      } @else if (scope.id !== null) {
        <holita-car-details [language]="scope.language" [carId]="scope.id" />
      } @else {
        <holita-karma-cars-page [language]="scope.language" />
      }
    }
  `,
})
export class KarmaWorkspace {
  private readonly management = viewChild(DeviceManagementPage);
  canLeave(): boolean | Promise<boolean> {
    return this.management()?.canLeave() ?? true;
  }
  private readonly workspace = inject(AdminWorkspace);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly scopes = computed(() => {
    const session = this.workspace.session.current();
    const section: unknown = this.data()['section'];
    return session
      ? [
          {
            token: session.token,
            language: this.workspace.language(),
            id: this.params().get('recordId'),
            edata: this.data()['edata'] === true,
            administration: this.data()['administration'] === true,
            section: typeof section === 'string' ? section : '',
          },
        ]
      : [];
  });
}
