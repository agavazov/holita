import { DemoSession } from '../../core/auth/demo-session';
import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { BranchWorkspace } from './branch-workspace';
import { routes } from '../../app.routes';
import { graphqlOptions } from '../../core/graphql/graphql-options';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const branches = [
  { id: branchA, name: 'Discordia' },
  { id: branchB, name: 'Sandbox' },
];

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function vehicles(branchId: string, name: string) {
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
            id: branchId.replace('1000', '2000'),
            branchId,
            licensePlate: name,
            notes: null,
            createdAt: '2026-10-11T00:00:00Z',
            updatedAt: '2026-10-11T00:00:00Z',
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

  it('recreates the branch boundary during A → B → A while Angular reuses the parameterized route', async () => {
    const harness = await RouterTestingHarness.create('/en');
    const discovery = http.expectOne((request) => operation(request, 'AdminBranches'));
    expect(discovery.request.headers.has('x-branch-id')).toBe(false);
    discovery.flush({ data: { branches } });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/en/${branchA}/fleet/vehicles`);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Vehicles');
    expect(harness.routeNativeElement?.textContent).not.toContain('Choose a branch to view');
    const pendingA = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(pendingA.request.headers.get('x-branch-id')).toBe(branchA);
    await harness.navigateByUrl(`/en/${branchB}/fleet/vehicles`);
    expect(pendingA.cancelled).toBe(true);
    const readB = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(readB.request.headers.get('x-branch-id')).toBe(branchB);
    readB.flush(vehicles(branchB, 'B only'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('B only');
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles`);
    const freshA = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(freshA.request.headers.get('x-branch-id')).toBe(branchA);
    expect(harness.routeNativeElement?.textContent).not.toContain('B only');
    freshA.flush(vehicles(branchA, 'Fresh A'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Fresh A');
    expect(harness.routeNativeElement?.textContent).not.toContain('B only');
  }, 10_000);

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
    if (!(workspace instanceof BranchWorkspace)) throw new Error('Missing workspace');
    workspace.refresh();
    http.expectOne('/graphql').flush({ errors: [{ message: 'Discovery unavailable' }] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Discovery unavailable');
    expect(workspace.branches()).toEqual(branches);
  });

  it('ignores an aborted Branches refresh after changing the workspace language', async () => {
    const harness = await RouterTestingHarness.create('/en/not-a-uuid/fleet/vehicles');
    http.expectOne('/graphql').flush({ data: { branches } });
    await harness.fixture.whenStable();
    const workspace: unknown = harness.routeDebugElement?.componentInstance;
    if (!(workspace instanceof BranchWorkspace)) throw new Error('Missing workspace');
    workspace.refresh();
    const oldRefresh = http.expectOne('/graphql');
    await harness.navigateByUrl('/bg/not-a-uuid/fleet/vehicles');
    expect(oldRefresh.cancelled).toBe(true);
    const discovery = http.expectOne('/graphql');
    expect(discovery.request.headers.get('Accept-Language')).toBe('bg');
    await harness.fixture.whenStable();
    expect(workspace.error()).toBeNull();
    expect(workspace.branches()).toEqual(branches);
    discovery.flush({ data: { branches } });
    await harness.fixture.whenStable();
    expect(workspace.error()).toBeNull();
  });

  it('cancels a pending Vehicles read and starts a new scoped client when the language changes', async () => {
    const harness = await RouterTestingHarness.create(`/en/${branchA}/fleet/vehicles`);
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    const oldRead = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(oldRead.request.headers.get('Accept-Language')).toBe('en');
    await harness.navigateByUrl(`/bg/${branchA}/fleet/vehicles`);
    expect(oldRead.cancelled).toBe(true);
    const newRead = http.expectOne((request) => operation(request, 'AdminVehicles'));
    expect(newRead.request.headers.get('x-branch-id')).toBe(branchA);
    expect(newRead.request.headers.get('Accept-Language')).toBe('bg');
    expect(newRead.request.headers.get('x-request-id')).not.toBe(
      oldRead.request.headers.get('x-request-id'),
    );
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    newRead.flush(vehicles(branchA, 'Bulgarian workspace'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain(
      'Bulgarian workspace',
    );
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).toBeNull();
  });
});
