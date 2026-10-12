import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { StoreWorkspace } from '../stores/store-workspace';
import { UsersPage } from './users-page/users-page';
import { RolesPage } from './roles-page/roles-page';
import { CarsPage } from './cars-page/cars-page';
import { CarDetails } from './car-details/car-details';
import { LocationPage } from './location-page/location-page';
import { ProjectsPage } from './projects-page/projects-page';
import { TimeZonesPage } from './time-zones-page/time-zones-page';
import { ApiInfoPage } from './api-info-page/api-info-page';
import { TripsPage } from './trips-page/trips-page';
import { EventsPage } from './events-page/events-page';
import { DrivingProfilePage } from './driving-profile-page/driving-profile-page';
import { EdataPage } from './edata-page/edata-page';

@Component({
  selector: 'holita-karma-workspace',
  imports: [
    UsersPage,
    RolesPage,
    CarsPage,
    CarDetails,
    EdataPage,
    TripsPage,
    EventsPage,
    DrivingProfilePage,
    LocationPage,
    ProjectsPage,
    TimeZonesPage,
    ApiInfoPage,
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
      @if (scope.section === 'users') {
        <holita-users-page [language]="scope.language" />
      } @else if (scope.section === 'roles') {
        <holita-roles-page [language]="scope.language" />
      } @else if (scope.section === 'projects') {
        <holita-projects-page [language]="scope.language" />
      } @else if (scope.section === 'time-zones') {
        <holita-time-zones-page [language]="scope.language" />
      } @else if (scope.section === 'api-info') {
        <holita-api-info-page [language]="scope.language" />
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
  private readonly workspace = inject(StoreWorkspace);
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
            section: typeof section === 'string' ? section : '',
          },
        ]
      : [];
  });
}
