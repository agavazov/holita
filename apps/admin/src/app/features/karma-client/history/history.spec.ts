import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, convertToParamMap } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { DemoSession } from '../../../core/auth/demo-session';
import { ADMIN_RUNTIME_CONFIG } from '../../../core/config/admin-config';
import { tripsFilters, eventsFilters, profileFilters, profilePeriod } from './history-filters';
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
const car = {
  __typename: 'KarmaCar',
  id: '41',
  projectId: '12',
  deviceId: '000123456789012',
  carNumber: 'TEST 41',
  carType: null,
  carYear: null,
  carColor: null,
  subType: null,
  timeZoneId: 0,
  driverCount: 0,
};
const trip = {
  __typename: 'KarmaTrip',
  id: '4000000001',
  carId: '41',
  carNumber: 'TEST 41',
  deviceId: car.deviceId,
  driverId: null,
  tripActive: 1,
  startMessageId: '3000000001',
  startDate: '2026-01-01 00:00:00',
  startLatitude: 0,
  startLongitude: 0,
  startOdo: 0,
  stopMessageId: null,
  stopDate: null,
  stopLatitude: null,
  stopLongitude: null,
  stopOdo: null,
  tripDuration: 0,
  tripDistance: 0,
  tripDurationNight: 0,
  tripDistanceNight: 0,
  maxSpeed: 0,
  drivingScore: 0,
  ecoScore: 0,
};
const event = {
  __typename: 'KarmaEvent',
  id: '3000000001',
  carId: '41',
  deviceId: car.deviceId,
  eventId: '0',
  edt: '2026-01-01 00:00:00',
  edtTz: null,
  pdt: null,
  latitude: 0,
  longitude: 0,
  spd: 0,
  odo: 0,
  extra: '<script>untrusted</script>',
};
const profile = {
  __typename: 'KarmaDrivingProfile',
  carId: '41',
  carNumber: 'TEST 41',
  deviceId: car.deviceId,
  categories: [
    { __typename: 'KarmaDrivingCategory', name: 'brakes', score: 0, weight: null },
    { __typename: 'KarmaDrivingCategory', name: 'speed', score: null, weight: 0 },
  ],
};
describe('History and period lifecycle', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
        {
          provide: ADMIN_RUNTIME_CONFIG,
          useValue: { graphqlUrl: '/graphql', fleetEnabled: false },
        },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'phase3-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });
  function read(name: string) {
    const request = http.expectOne((req) => operation(req, name));
    expect(request.request.headers.has('x-branch-id')).toBe(false);
    return request;
  }
  async function open(section: string) {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/41/' + section);
    read('AdminBranches').flush({ data: { branches: [] } });
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    await harness.fixture.whenStable();
    return harness;
  }
  it('starts trips without dates at 50 and exposes all 23 original fields', async () => {
    const harness = await open('trips'),
      pending = read('AdminKarmaTrips');
    expect(pending.request.body).toMatchObject({
      variables: { input: { carId: '41', pageSize: 50, fromDate: null, toDate: null } },
    });
    pending.flush({
      data: {
        karmaTrips: {
          __typename: 'KarmaTripsPage',
          items: [trip],
          hasMore: false,
          cursor: 'fixture',
          nextCursor: null,
        },
      },
    });
    await harness.fixture.whenStable();
    const button = harness.routeNativeElement?.querySelector('tbody button');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Missing details');
    button.click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelectorAll('dd')).toHaveLength(23);
    expect(harness.routeNativeElement?.textContent).toContain('stop_date');
  });
  it('escapes all event extra text and cancels an obsolete read when filters change', async () => {
    const harness = await open('events');
    const obsolete = read('AdminKarmaEvents');
    await harness.navigateByUrl(
      '/en/karma-client/cars/41/events?types=0&from=2026-01-01T00:00&to=2026-01-02T00:00',
    );
    expect(obsolete.cancelled).toBe(true);
    const pending = read('AdminKarmaEvents');
    expect(pending.request.body).toMatchObject({
      variables: { input: { eventTypes: ['0'], fromDate: '2026-01-01T00:00:00Z' } },
    });
    pending.flush({
      data: {
        karmaEvents: {
          __typename: 'KarmaEventsPage',
          items: [event],
          hasMore: false,
          cursor: 'fixture',
          nextCursor: null,
        },
      },
    });
    await harness.fixture.whenStable();
    const button = harness.routeNativeElement?.querySelector('tbody button');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Missing details');
    button.click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelectorAll('dd')).toHaveLength(12);
    expect(harness.routeNativeElement?.querySelector('dl')?.textContent).toContain(
      '<script>untrusted</script>',
    );
    expect(harness.routeNativeElement?.querySelector('dl script')).toBeNull();
  });
  it('retires trip/event reads across A → B → A, language and logout', async () => {
    const harness = await open('trips');
    const a = read('AdminKarmaTrips');
    await harness.navigateByUrl('/en/karma-client/cars/42/events');
    expect(a.cancelled).toBe(true);
    read('AdminKarmaCar').flush({ data: { karmaCar: { ...car, id: '42' } } });
    await harness.fixture.whenStable();
    const b = read('AdminKarmaEvents');
    await harness.navigateByUrl('/en/karma-client/cars/41/trips');
    expect(b.cancelled).toBe(true);
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    await harness.fixture.whenStable();
    const again = read('AdminKarmaTrips');
    await harness.navigateByUrl('/bg/karma-client/cars/41/trips');
    expect(again.cancelled).toBe(true);
    read('AdminBranches').flush({ data: { branches: [] } });
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    await harness.fixture.whenStable();
    const bg = read('AdminKarmaTrips');
    expect(bg.request.headers.get('accept-language')).toBe('bg');
    TestBed.inject(DemoSession).logout();
    await harness.fixture.whenStable();
    expect(bg.cancelled).toBe(true);
    read('AdminTenants').flush({ data: { tenants: [] } });
  });
  it('uses a seven-day profile period, preserves zero/null and clears old data for a new period', async () => {
    const harness = await open('driving-profile');
    const pending = read('AdminKarmaDrivingProfile'),
      body: unknown = pending.request.body;
    if (
      typeof body !== 'object' ||
      body === null ||
      !('variables' in body) ||
      typeof body.variables !== 'object' ||
      body.variables === null ||
      !('input' in body.variables) ||
      typeof body.variables.input !== 'object' ||
      body.variables.input === null ||
      !('fromDate' in body.variables.input) ||
      !('toDate' in body.variables.input) ||
      typeof body.variables.input.fromDate !== 'string' ||
      typeof body.variables.input.toDate !== 'string'
    )
      throw new Error('Missing period');
    expect(
      new Date(body.variables.input.toDate + 'Z').getTime() -
        new Date(body.variables.input.fromDate + 'Z').getTime(),
    ).toBe(7 * 86400000);
    pending.flush({ data: { karmaDrivingProfile: profile } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('0');
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('—');
    await harness.navigateByUrl(
      '/en/karma-client/cars/41/driving-profile?from=2026-01-01T00:00&to=2026-02-01T00:00',
    );
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).not.toContain('brakes');
    const next = read('AdminKarmaDrivingProfile');
    await harness.navigateByUrl('/en/karma-client/cars/42/driving-profile');
    expect(next.cancelled).toBe(true);
    read('AdminKarmaCar').flush({ data: { karmaCar: null } });
    await harness.fixture.whenStable();
    http.expectNone((req) => operation(req, 'AdminKarmaDrivingProfile'));
  });
  it('rejects invalid filters locally and allows a native form submit to replace them', async () => {
    const harness = await open('events?types=-1');
    http.expectNone((req) => operation(req, 'AdminKarmaEvents'));
    const input = harness.routeNativeElement?.querySelector('#events-types');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing filter');
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    const form = harness.routeNativeElement?.querySelector('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('types=0');
    read('AdminKarmaEvents').flush({
      data: {
        karmaEvents: {
          __typename: 'KarmaEventsPage',
          items: [],
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    });
    await harness.fixture.whenStable();
  });
  it('validates period syntax, optional filters and code zero without implicit timezone conversion', () => {
    expect(
      tripsFilters('41', convertToParamMap({ from: '2026-01-01T00:00', to: '2026-01-02T00:00' })),
    ).toMatchObject({ fromDate: '2026-01-01T00:00:00' });
    expect(eventsFilters('41', convertToParamMap({ types: '0,33,0' }))).toMatchObject({
      eventTypes: ['0', '33'],
    });
    expect(
      eventsFilters('41', convertToParamMap({ from: '2026-02-30T00:00', to: '2026-03-01T00:00' })),
    ).toBeNull();
    expect(
      profileFilters('41', convertToParamMap({ from: '', to: '' }), profilePeriod()),
    ).toBeNull();
  });
});
