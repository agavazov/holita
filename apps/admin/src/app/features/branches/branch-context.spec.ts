import { DemoSession } from '../../core/auth/demo-session';
import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouteReuseStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { routes } from '../../app.routes';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import type { AdminVehicleDetailsFragment } from '../../../generated/graphql/operations';
import { FleetRouteReuseStrategy } from '../fleet/fleet-route-reuse';

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

function vehicles(branchId: string, name: string) {
  const vehicle: AdminVehicleDetailsFragment = {
    id: branchId.replace('1000', '2000'),
    branchId,
    licensePlate: name,
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
    notes: null,
    createdAt: '2026-10-11T00:00:00Z',
    updatedAt: '2026-10-11T00:00:00Z',
  };
  return {
    data: {
      fleetVehicles: {
        __typename: 'FleetVehiclePage',
        total: 1,
        offset: 0,
        limit: 20,
        items: [
          {
            __typename: 'FleetVehicle',
            ...vehicle,
          },
        ],
      },
    },
  };
}

describe('Angular branch routing', () => {
  let http: HttpTestingController;
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
    TestBed.inject(DemoSession).start({
      token: 'test-demo-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });
  async function loadPreferences(
    harness: RouterTestingHarness,
    branchId = branchA,
    language = 'en',
  ) {
    const request = http.expectOne((candidate) => operation(candidate, 'AdminFleetPreferences'));
    expect(request.request.headers.get('x-branch-id')).toBe(branchId);
    expect(request.request.headers.get('Accept-Language')).toBe(language);
    request.flush({ data: { fleetSettings: preferences } });
    await harness.fixture.whenStable();
  }

  it('recreates the branch boundary during A → B → A while Angular reuses the parameterized route', async () => {
    const harness = await RouterTestingHarness.create('/en');
    const discovery = http.expectOne((request) => operation(request, 'AdminBranches'));
    expect(discovery.request.headers.has('x-branch-id')).toBe(false);
    discovery.flush({ data: { branches } });
    await harness.fixture.whenStable();
    await loadPreferences(harness);
    expect(TestBed.inject(Router).url).toBe(`/en/${branchA}/fleet/overview`);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Overview');
    const overview = http.expectOne((request) => operation(request, 'AdminFleetOverview'));
    expect(overview.request.headers.get('x-branch-id')).toBe(branchA);
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles`);
    expect(overview.cancelled).toBe(true);
    await loadPreferences(harness);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Vehicles');
    expect(harness.routeNativeElement?.textContent).not.toContain('Choose a branch to view');
    const pendingA = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(pendingA.request.headers.get('x-branch-id')).toBe(branchA);
    await harness.navigateByUrl(`/en/${branchB}/fleet/vehicles`);
    expect(pendingA.cancelled).toBe(true);
    await loadPreferences(harness, branchB);
    const readB = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(readB.request.headers.get('x-branch-id')).toBe(branchB);
    readB.flush(vehicles(branchB, 'B only'));
    flushVehicleContext(http);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('B only');
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles`);
    await loadPreferences(harness);
    const freshA = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(freshA.request.headers.get('x-branch-id')).toBe(branchA);
    expect(harness.routeNativeElement?.textContent).not.toContain('B only');
    freshA.flush(vehicles(branchA, 'Fresh A'));
    flushVehicleContext(http);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Fresh A');
    expect(harness.routeNativeElement?.textContent).not.toContain('B only');
  }, 10_000);

  it('redirects a Fleet root link to Overview while preserving its URL context', async () => {
    const harness = await RouterTestingHarness.create(
      `/en/${branchA}/fleet?search=kept#main-content`,
    );
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    await loadPreferences(harness);
    expect(TestBed.inject(Router).url).toBe(
      `/en/${branchA}/fleet/overview?search=kept#main-content`,
    );
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Overview');
    const read = http.expectOne((request) => operation(request, 'AdminFleetOverview'));
    expect(read.request.headers.get('x-branch-id')).toBe(branchA);
    expect(read.request.headers.get('Accept-Language')).toBe('en');
    http.expectNone((request) => operation(request, 'AdminVehicles'));
  });

  it('shows empty and unavailable branches without issuing business queries', async () => {
    const harness = await RouterTestingHarness.create('/en');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No branches available.');
    http.expectNone('/graphql');
    await harness.navigateByUrl('/en/not-a-uuid/fleet/vehicles');
    http.expectNone('/graphql');
  });

  it('blocks an unknown branch and preserves loaded discovery on a refresh failure', async () => {
    const harness = await RouterTestingHarness.create('/en/not-a-uuid/fleet/vehicles');
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Branch not found');
    http.expectNone('/graphql');
    const workspace: unknown = harness.routeDebugElement?.componentInstance;
    if (!(workspace instanceof AdminWorkspace)) {
      throw new Error('Missing workspace');
    }
    workspace.branches.refresh();
    http.expectOne('/graphql').flush({ errors: [{ message: 'Discovery unavailable' }] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Discovery unavailable');
    expect(workspace.branches.branches()).toEqual(branches);
  });

  it('ignores an aborted Branches refresh after changing the workspace language', async () => {
    const harness = await RouterTestingHarness.create('/en/not-a-uuid/fleet/vehicles');
    http.expectOne('/graphql').flush({ data: { branches } });
    await harness.fixture.whenStable();
    const workspace: unknown = harness.routeDebugElement?.componentInstance;
    if (!(workspace instanceof AdminWorkspace)) {
      throw new Error('Missing workspace');
    }
    workspace.branches.refresh();
    const oldRefresh = http.expectOne('/graphql');
    await harness.navigateByUrl('/bg/not-a-uuid/fleet/vehicles');
    expect(oldRefresh.cancelled).toBe(true);
    const discovery = http.expectOne('/graphql');
    expect(discovery.request.headers.get('Accept-Language')).toBe('bg');
    await harness.fixture.whenStable();
    expect(workspace.branches.error()).toBeNull();
    expect(workspace.branches.branches()).toEqual(branches);
    discovery.flush({ data: { branches } });
    await harness.fixture.whenStable();
    expect(workspace.branches.error()).toBeNull();
  });

  it('cancels a pending Vehicles read and starts a new scoped client when the language changes', async () => {
    const harness = await RouterTestingHarness.create(`/en/${branchA}/fleet/vehicles`);
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    await loadPreferences(harness);
    const oldRead = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(oldRead.request.headers.get('Accept-Language')).toBe('en');
    await harness.navigateByUrl(`/bg/${branchA}/fleet/vehicles`);
    expect(oldRead.cancelled).toBe(true);
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    await loadPreferences(harness, branchA, 'bg');
    const newRead = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(newRead.request.headers.get('x-branch-id')).toBe(branchA);
    expect(newRead.request.headers.get('Accept-Language')).toBe('bg');
    expect(newRead.request.headers.get('x-request-id')).not.toBe(
      oldRead.request.headers.get('x-request-id'),
    );
    newRead.flush(vehicles(branchA, 'Bulgarian workspace'));
    flushVehicleContext(http);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain(
      'Bulgarian workspace',
    );
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).toBeNull();
  }, 15_000);

  it('keeps General settings on a Branch switch, clears URL context and loads only the new Branch preferences', async () => {
    const harness = await RouterTestingHarness.create(
      `/en/${branchA}/fleet/settings/general?search=old#settings`,
    );
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    await loadPreferences(harness);
    expect(
      harness.routeNativeElement?.querySelector<HTMLInputElement>('#settings-name')?.value,
    ).toBe('Discordia');
    const workspace: unknown = harness.routeDebugElement?.componentInstance;
    if (!(workspace instanceof AdminWorkspace)) {
      throw new Error('Missing AdminWorkspace.');
    }
    workspace.branches.choose(branchB, 'en');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/en/${branchB}/fleet/settings/general`);
    await loadPreferences(harness, branchB);
    expect(
      harness.routeNativeElement?.querySelector<HTMLInputElement>('#settings-name')?.value,
    ).toBe('Sandbox');
    http.expectNone('/graphql');
  });
});
