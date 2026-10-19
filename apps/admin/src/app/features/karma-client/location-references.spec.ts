import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { DemoSession } from '../../core/auth/demo-session';
import { ADMIN_RUNTIME_CONFIG } from '../../core/config/admin-config';
import { locationMap } from './location/location-map';

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
const point = {
  __typename: 'KarmaLocation',
  carId: '41',
  deviceId: car.deviceId,
  carNumber: car.carNumber,
  messageId: '3000000001',
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
const references = {
  data: {
    karmaProjects: [{ __typename: 'KarmaProject', id: '12', name: 'Fixture project' }],
    karmaTimeZones: [{ __typename: 'KarmaTimeZone', id: 0, name: 'UTC' }],
  },
};

describe('Location and reference reads and view retirement', () => {
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
      token: 'phase2-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });
  function branches() {
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
  }
  function read(name: string) {
    const pending = http.expectOne((request) => operation(request, name));
    expect(pending.request.headers.has('x-branch-id')).toBe(false);
    return pending;
  }

  it('renders all location fields, escaped extra and valid zero coordinates', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/41/location');
    branches();
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    await harness.fixture.whenStable();
    const pending = read('AdminKarmaLocation');
    expect(pending.request.headers.get('authorization')).toBe('Bearer phase2-a');
    pending.flush({ data: { karmaLocation: point } });
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement;
    expect(element?.querySelectorAll('dd').length).toBe(13);
    expect(element?.querySelector('dl')?.textContent).toContain('<script>untrusted</script>');
    expect(element?.querySelector('dl script')).toBeNull();
    expect(element?.querySelector('a[target="_blank"]')?.getAttribute('href')).toContain(
      'mlat=0&mlon=0',
    );
  });
  it('preserves null coordinates without a map link, rejects malformed routes and handles missing trucks', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/41/location');
    branches();
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    await harness.fixture.whenStable();
    read('AdminKarmaLocation').flush({
      data: { karmaLocation: { ...point, latitude: null, longitude: null, messageId: null } },
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('a[target="_blank"]')).toBeNull();
    await harness.navigateByUrl('/en/karma-client/cars/999/location');
    read('AdminKarmaCar').flush({ data: { karmaCar: null } });
    await harness.fixture.whenStable();
    http.expectNone((request) => operation(request, 'AdminKarmaLocation'));
    expect(harness.routeNativeElement?.textContent).toContain('Truck not found');
    await harness.navigateByUrl('/en/karma-client/cars/not-an-id/location');
    http.expectNone((request) => operation(request, 'AdminKarmaLocation'));
  });
  it('retires location reads on truck, language and session changes and logout', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/41/location');
    branches();
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    await harness.fixture.whenStable();
    let pending = read('AdminKarmaLocation');
    await harness.navigateByUrl('/en/karma-client/cars/42/location');
    expect(pending.cancelled).toBe(true);
    read('AdminKarmaCar').flush({ data: { karmaCar: { ...car, id: '42' } } });
    await harness.fixture.whenStable();
    pending = read('AdminKarmaLocation');
    await harness.navigateByUrl('/bg/karma-client/cars/42/location');
    expect(pending.cancelled).toBe(true);
    branches();
    read('AdminKarmaCar').flush({ data: { karmaCar: { ...car, id: '42' } } });
    await harness.fixture.whenStable();
    pending = read('AdminKarmaLocation');
    expect(pending.request.headers.get('Accept-Language')).toBe('bg');
    const session = TestBed.inject(DemoSession);
    session.start({
      token: 'phase2-b',
      tenant: { id: '01000000-0000-4000-8000-000000000002', name: 'B' },
    });
    await harness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    branches();
    pending = read('AdminKarmaCar');
    expect(pending.request.headers.get('authorization')).toBe('Bearer phase2-b');
    session.logout();
    await harness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    read('AdminTenants').flush({ data: { tenants: [] } });
  });
  it('keeps truck details on lookup failure and resolves names and IDs after refresh', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/41');
    branches();
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    read('AdminKarmaReferences').flush({ errors: [{ message: 'Unavailable' }] });
    await harness.fixture.whenStable();
    read('AdminKarmaLocation').flush({ data: { karmaLocation: point } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('dl')?.textContent).toContain(
      '000123456789012',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Reference names are unavailable');
    const refresh = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent.includes('Refresh'),
    );
    refresh?.click();
    await harness.fixture.whenStable();
    read('AdminKarmaReferences').flush(references);
    read('AdminKarmaCar').flush({ data: { karmaCar: car } });
    read('AdminKarmaLocation').flush({ data: { karmaLocation: point } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('dl')?.textContent).toContain(
      'Fixture project (12)',
    );
    expect(harness.routeNativeElement?.querySelector('dl')?.textContent).toContain('UTC (0)');
  });
  it('preserves bookmarked reference search and page, uses fresh clients per account view and on language changes', async () => {
    const harness = await RouterTestingHarness.create(
      '/en/karma-client/time-zones?first=50&size=50&q=zone',
    );
    branches();
    const pending = read('AdminKarmaTimeZones');
    pending.flush({
      data: {
        karmaTimeZones: Array.from({ length: 120 }, (_, id) => ({
          __typename: 'KarmaTimeZone',
          id,
          name: `Zone ${String(id)}`,
        })),
      },
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('Zone 50');
    expect(harness.routeNativeElement?.querySelectorAll('tbody tr').length).toBe(50);
    await harness.navigateByUrl('/en/karma-client/projects');
    const project = read('AdminKarmaProjects');
    await harness.navigateByUrl('/en/karma-client/api-info');
    expect(project.cancelled).toBe(true);
    const version = read('AdminKarmaVersion');
    await harness.navigateByUrl('/bg/karma-client/api-info');
    expect(version.cancelled).toBe(true);
    branches();
    const bg = read('AdminKarmaVersion');
    expect(bg.request.headers.get('Accept-Language')).toBe('bg');
    bg.flush({ data: { karmaVersion: { __typename: 'KarmaVersion', version: '2.26.1.1' } } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('2.26.1.1');
  });
  it('submits reference search without a native form reload and resets the page offset', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/projects?first=50');
    branches();
    read('AdminKarmaProjects').flush(references);
    await harness.fixture.whenStable();
    const input = harness.routeNativeElement?.querySelector('input');
    if (!input) {
      throw new Error('Missing search');
    }
    input.value = 'Fixture';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    harness.routeNativeElement
      ?.querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('q=Fixture');
    expect(TestBed.inject(Router).url).not.toContain('first=');
    http.expectNone((request) => operation(request, 'AdminKarmaProjects'));
  });

  it('cancels account reads across session A → B → A and logout', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/projects');
    branches();
    let pending = read('AdminKarmaProjects');
    const session = TestBed.inject(DemoSession);
    for (const token of ['phase2-b', 'phase2-a']) {
      session.start({ token, tenant: { id: '01000000-0000-4000-8000-000000000002', name: 'B' } });
      await harness.fixture.whenStable();
      expect(pending.cancelled).toBe(true);
      branches();
      pending = read('AdminKarmaProjects');
      expect(pending.request.headers.get('authorization')).toBe('Bearer ' + token);
    }
    session.logout();
    await harness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    read('AdminTenants').flush({ data: { tenants: [] } });
  });
});

describe('map coordinate boundaries', () => {
  it('accepts zeros and valid boundary pairs and rejects absent/nonfinite/out-of-range values', () => {
    expect(locationMap(0, 0)).toContain('mlat=0&mlon=0');
    expect(locationMap(90, -180)).not.toBeNull();
    for (const [latitude, longitude] of [
      [null, 0],
      [0, null],
      [91, 0],
      [0, 181],
      [Infinity, 0],
      [0, NaN],
    ]) {
      expect(locationMap(latitude, longitude)).toBeNull();
    }
  });
});
