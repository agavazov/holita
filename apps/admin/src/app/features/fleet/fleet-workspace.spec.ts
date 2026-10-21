import { DemoSession } from '../../core/auth/demo-session';
import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../app.routes';
import { ADMIN_RUNTIME_CONFIG } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import { AdminShell } from '../../layout/admin-shell';
import type { AdminVehicleDetailsFragment } from '../../../generated/graphql/operations';
import { FleetRouteReuseStrategy } from './fleet-route-reuse';
import { VehicleEditorPage } from './vehicles/vehicle-editor-page';
import { VehiclesPage } from './vehicles/vehicles-page';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const branches = [
  { id: branchA, name: 'Discordia' },
  { id: branchB, name: 'Sandbox' },
];
const preferences = {
  __typename: 'FleetSettings',
  timeZone: 'Europe/Sofia',
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
};
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function flushVehicleContext(http: HttpTestingController): void {
  const responses = {
    AdminDeviceSummary: {
      fleetDeviceSummary: { dataAsOf: null, online: 0, offline: 0, inStock: 0 },
    },
    AdminDeviceVehicles: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 100 } },
    AdminVehicleSummary: {
      fleetVehicleSummary: {
        dataAsOf: null,
        inOperation: 0,
        inWorkshop: 0,
        moving: 0,
        notReporting: 0,
        openAlerts: 0,
        lowFuel: 0,
      },
    },
    AdminVehicleGroups: { fleetVehicleGroups: { items: [], total: 0, offset: 0, limit: 100 } },
    AdminVehicleDrivers: { fleetDrivers: { items: [], total: 0, offset: 0, limit: 100 } },
  };
  for (const [name, data] of Object.entries(responses)) {
    for (const request of http.match((candidate) => operation(candidate, name))) {
      if (!request.cancelled) {
        request.flush({ data });
      }
    }
  }
}
describe.each([
  ['vehicles', 'Vehicle'],
  ['devices', 'Device'],
])('Fleet %s availability and workspace routing', (resource, entity) => {
  const path = `/en/${branchA}/fleet/${resource}`;
  const listOperation = `Admin${entity}s`;
  const empty = {
    data: {
      [`fleet${entity}s`]: {
        __typename: `Fleet${entity}Page`,
        items: [],
        total: 0,
        offset: 0,
        limit: 20,
      },
    },
  };
  let http: HttpTestingController;
  let mounted: RouterTestingHarness | undefined;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: RouteReuseStrategy, useClass: FleetRouteReuseStrategy },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
      ],
    });
  });
  afterEach(() => {
    mounted?.fixture.destroy();
    mounted = undefined;
    document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
      element.remove();
    });
    TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true });
  });
  async function mount(url = path) {
    TestBed.inject(DemoSession).start({
      token: 'test-demo-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' },
    });
    http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create(url);
    mounted = harness;
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    return harness;
  }
  async function loadPreferences(
    harness: RouterTestingHarness,
    branchId = branchA,
    language = 'en',
  ) {
    const request = await vi.waitFor(() =>
      http.expectOne(
        (candidate) =>
          operation(candidate, 'AdminFleetPreferences') &&
          candidate.headers.get('x-branch-id') === branchId,
      ),
    );
    expect(request.request.headers.get('Accept-Language')).toBe(language);
    request.flush({ data: { fleetSettings: preferences } });
    await harness.fixture.whenStable();
    return request;
  }
  it.each(['', '/new', '/20000000-0000-4000-8000-000000000001/edit'])(
    'redirects previous Reference URLs with suffix "%s" while preserving language, query and fragment',
    async (suffix) => {
      TestBed.overrideProvider(ADMIN_RUNTIME_CONFIG, {
        useValue: { graphqlUrl: '/graphql', fleetEnabled: false },
      });
      const harness = await mount();
      for (const language of ['en', 'bg']) {
        await harness.navigateByUrl(
          `/${language}/${branchA}/reference/${resource}${suffix}?search=old&page=2#main-content`,
        );
        if (language === 'bg') {
          http
            .expectOne((request) => operation(request, 'AdminBranches'))
            .flush({ data: { branches } });
          await harness.fixture.whenStable();
        }
        expect(TestBed.inject(Router).url).toBe(
          `/${language}/${branchA}/fleet/${resource}${suffix}?search=old&page=2#main-content`,
        );
        http.expectNone('/graphql');
      }
    },
    15000,
  );
  it('blocks all business routes and navigation when disabled while leaving branch discovery usable', async () => {
    TestBed.overrideProvider(ADMIN_RUNTIME_CONFIG, {
      useValue: { graphqlUrl: '/graphql', fleetEnabled: false },
    });
    const harness = await mount();
    for (const suffix of ['', '/new', '/20000000-0000-4000-8000-000000000001/edit']) {
      await harness.navigateByUrl(path + suffix);
      expect(harness.routeNativeElement?.textContent).toContain('Fleet is unavailable.');
      expect(
        harness.routeNativeElement?.querySelector(
          `holita-admin-sidebar a[href*="fleet/${resource}"]`,
        ),
      ).toBeNull();
      http.expectNone('/graphql');
    }
    await harness.navigateByUrl('/en');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/en/${branchA}/fleet/overview`);
    expect(harness.routeNativeElement?.textContent).toContain('Fleet is unavailable.');
    http.expectNone('/graphql');
  }, 15000);
  it('does not issue business requests for unknown branches', async () => {
    const harness = await mount(`/en/not-a-branch/fleet/${resource}/new`);
    expect(harness.routeNativeElement?.textContent).toContain('Branch not found');
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    http.expectNone('/graphql');
  });
  it('keeps the Fleet section, resets query context and cancels reads during A → B → A', async () => {
    const harness = await mount(path + '?search=old&page=2');
    await loadPreferences(harness);
    expect(harness.routeNativeElement?.querySelector('aside nav')?.textContent).toContain('Fleet');
    expect(
      harness.routeNativeElement
        ?.querySelector(`holita-admin-sidebar a[href$="/fleet/${resource}"]`)
        ?.getAttribute('href'),
    ).toBe(path);
    const oldRead = http.expectOne((request) => operation(request, listOperation));
    const shell: unknown = harness.routeDebugElement?.query(
      By.directive(AdminShell),
    ).componentInstance;
    if (!(shell instanceof AdminShell)) {
      throw new Error('Missing shell.');
    }
    shell.chooseBranch(branchB);
    await loadPreferences(harness, branchB);
    const readB = await vi.waitFor(() =>
      http.expectOne(
        (request) =>
          operation(request, listOperation) && request.headers.get('x-branch-id') === branchB,
      ),
    );
    await vi.waitFor(() => {
      expect(oldRead.cancelled).toBe(true);
    });
    expect(TestBed.inject(Router).url).toBe(path.replace(branchA, branchB));
    expect(readB.request.headers.get('x-branch-id')).toBe(branchB);
    expect(readB.request.body).toMatchObject({ variables: { offset: 0, limit: 20 } });
    readB.flush(empty);
    flushVehicleContext(http);
    const retiredReads = http.match(
      (request) =>
        operation(request, listOperation) && request.headers.get('x-branch-id') === branchA,
    );
    expect(retiredReads.every((read) => read.cancelled)).toBe(true);
    shell.chooseBranch(branchA);
    await loadPreferences(harness);
    const freshA = await vi.waitFor(() =>
      http.expectOne(
        (request) =>
          operation(request, listOperation) && request.headers.get('x-branch-id') === branchA,
      ),
    );
    expect(freshA.request.headers.get('x-branch-id')).toBe(branchA);
    freshA.flush(empty);
    flushVehicleContext(http);
    await vi.waitFor(() => {
      expect(TestBed.inject(Router).url).toBe(path);
    });
  });
  if (resource === 'vehicles') {
    it('gates every business query until preferences load and recovers an initial preferences failure through Retry', async () => {
      const harness = await mount();
      const initial = http.expectOne((request) => operation(request, 'AdminFleetPreferences'));
      expect(initial.request.headers.get('x-branch-id')).toBe(branchA);
      expect(harness.routeNativeElement?.querySelector('holita-vehicles-page')).toBeNull();
      http.expectNone((request) => operation(request, 'AdminVehicles'));
      http.expectNone((request) => operation(request, 'AdminVehicleSummary'));
      initial.flush('Unavailable', { status: 503, statusText: 'Unavailable' });
      await harness.fixture.whenStable();
      expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
      http.expectNone((request) => operation(request, 'AdminVehicles'));
      const retry = Array.from(
        harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      ).find((button) => button.textContent.trim() === 'Retry');
      if (!retry) {
        throw new Error('Missing preferences Retry action.');
      }
      retry.click();
      await loadPreferences(harness);
      http.expectOne((request) => operation(request, 'AdminVehicles')).flush(empty);
      flushVehicleContext(http);
      await harness.fixture.whenStable();
      expect(harness.routeNativeElement?.querySelector('holita-vehicles-page')).not.toBeNull();
      expect(harness.routeNativeElement?.querySelector('[role="alert"]')).toBeNull();
    });

    it('retires pending preferences during A → B → A and language changes without starting business queries in old scopes', async () => {
      const harness = await mount();
      const a = http.expectOne((request) => operation(request, 'AdminFleetPreferences'));
      await harness.navigateByUrl(path.replace(branchA, branchB));
      expect(a.cancelled).toBe(true);
      const b = http.expectOne((request) => operation(request, 'AdminFleetPreferences'));
      expect(b.request.headers.get('x-branch-id')).toBe(branchB);
      await harness.navigateByUrl(path);
      expect(b.cancelled).toBe(true);
      const freshA = http.expectOne((request) => operation(request, 'AdminFleetPreferences'));
      expect(freshA.request.headers.get('x-branch-id')).toBe(branchA);
      expect(freshA.request.headers.get('x-request-id')).not.toBe(
        a.request.headers.get('x-request-id'),
      );
      http.expectNone((request) => operation(request, 'AdminVehicles'));
      await harness.navigateByUrl(path.replace('/en/', '/bg/'));
      expect(freshA.cancelled).toBe(true);
      http
        .expectOne((request) => operation(request, 'AdminBranches'))
        .flush({ data: { branches } });
      await harness.fixture.whenStable();
      const bg = http.expectOne((request) => operation(request, 'AdminFleetPreferences'));
      expect(bg.request.headers.get('x-branch-id')).toBe(branchA);
      expect(bg.request.headers.get('Accept-Language')).toBe('bg');
      expect(bg.request.headers.get('authorization')).toBe('Bearer test-demo-token');
      expect(bg.request.headers.get('x-request-id')).not.toBe(
        freshA.request.headers.get('x-request-id'),
      );
      http.expectNone((request) => operation(request, 'AdminVehicles'));
      bg.flush({
        data: { fleetSettings: { ...preferences, distanceUnit: 'MI', volumeUnit: 'US_GALLON' } },
      });
      await harness.fixture.whenStable();
      const list = http.expectOne((request) => operation(request, 'AdminVehicles'));
      expect(list.request.headers.get('x-branch-id')).toBe(branchA);
      expect(list.request.headers.get('Accept-Language')).toBe('bg');
      list.flush(empty);
      flushVehicleContext(http);
      await harness.fixture.whenStable();
      expect(harness.routeNativeElement?.querySelector('holita-vehicles-page')).not.toBeNull();
      expect(harness.routeNativeElement?.querySelector('[role="alert"]')).toBeNull();
    });

    it('retains the list while replacing A → B → A editors and cancelling obsolete detail reads', async () => {
      const firstId = '20000000-0000-4000-8000-000000000001';
      const secondId = '20000000-0000-4000-8000-000000000002';
      const harness = await mount(`${path}/${firstId}/edit`);
      await loadPreferences(harness);
      http.expectOne((request) => operation(request, listOperation)).flush(empty);
      flushVehicleContext(http);
      await harness.fixture.whenStable();
      const list: unknown = harness.routeDebugElement?.query(
        By.directive(VehiclesPage),
      ).componentInstance;
      const firstEditor: unknown = harness.routeDebugElement?.query(
        By.directive(VehicleEditorPage),
      ).componentInstance;
      expect(list).toBeInstanceOf(VehiclesPage);
      expect(firstEditor).toBeInstanceOf(VehicleEditorPage);
      const oldRead = http.expectOne((request) => operation(request, 'AdminVehicle'));
      expect(oldRead.request.body).toMatchObject({ variables: { id: firstId } });
      await harness.navigateByUrl(`${path}/${secondId}/edit`);
      http.expectNone((request) => operation(request, 'AdminFleetPreferences'));
      expect(oldRead.cancelled).toBe(true);
      const secondEditor: unknown = harness.routeDebugElement?.query(
        By.directive(VehicleEditorPage),
      ).componentInstance;
      expect(secondEditor).toBeInstanceOf(VehicleEditorPage);
      expect(secondEditor).not.toBe(firstEditor);
      expect(harness.routeDebugElement?.query(By.directive(VehiclesPage)).componentInstance).toBe(
        list,
      );
      const readB = http.expectOne((request) => operation(request, 'AdminVehicle'));
      expect(readB.request.body).toMatchObject({ variables: { id: secondId } });
      readB.flush({ data: { fleetVehicle: vehicleRecord(secondId, 'Current B') } });
      flushVehicleContext(http);
      await vi.waitFor(() => {
        expect(currentPlate().value).toBe('Current B');
      });
      http.expectNone((request) => operation(request, listOperation));
      await harness.navigateByUrl(`${path}/${firstId}/edit`);
      http.expectNone((request) => operation(request, 'AdminFleetPreferences'));
      const freshEditor: unknown = harness.routeDebugElement?.query(
        By.directive(VehicleEditorPage),
      ).componentInstance;
      expect(freshEditor).not.toBe(firstEditor);
      expect(freshEditor).not.toBe(secondEditor);
      expect(harness.routeDebugElement?.query(By.directive(VehiclesPage)).componentInstance).toBe(
        list,
      );
      const freshRead = http.expectOne((request) => operation(request, 'AdminVehicle'));
      expect(freshRead.request.body).toMatchObject({ variables: { id: firstId } });
      expect(freshRead.request.headers.get('x-request-id')).not.toBe(
        oldRead.request.headers.get('x-request-id'),
      );
      freshRead.flush({ data: { fleetVehicle: vehicleRecord(firstId, 'Fresh A') } });
      flushVehicleContext(http);
      await vi.waitFor(() => {
        expect(currentPlate().value).toBe('Fresh A');
      });
      http.expectNone((request) => operation(request, listOperation));
    });
  }
});

function currentPlate(): HTMLInputElement {
  const drawer = Array.from(document.querySelectorAll<HTMLElement>('.p-drawer[role="dialog"]')).at(
    -1,
  );
  const input = drawer?.querySelector<HTMLInputElement>('#vehicle-plate');
  if (!input) {
    throw new Error('Missing current vehicle drawer plate.');
  }
  return input;
}

function vehicleRecord(
  id: string,
  licensePlate: string,
): AdminVehicleDetailsFragment & { readonly __typename: 'FleetVehicle' } {
  return {
    __typename: 'FleetVehicle',
    id,
    branchId: branchA,
    licensePlate,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fleetNumber: null,
    vehicleType: null,
    make: null,
    model: null,
    modelYear: null,
    vin: null,
    fuelType: null,
    fuelTankCapacityL: null,
    status: 'ACTIVE',
    groupId: null,
    group: null,
    currentDriverId: null,
    currentDriver: null,
    deviceCount: 0,
    openAlertCount: 0,
    state: {
      activity: 'NO_DEVICE',
      lastReportedAt: null,
      latitude: null,
      longitude: null,
      address: null,
      speedKph: null,
      headingDeg: null,
      ignition: null,
      fuelLevelPct: null,
      fuelStatus: 'NO_DATA',
      externalVoltage: null,
      backupBatteryVoltage: null,
      engineHours: null,
      coolantTempC: null,
      odometerKm: null,
      odometerRecordedAt: null,
      odometerSource: null,
    },
  };
}
