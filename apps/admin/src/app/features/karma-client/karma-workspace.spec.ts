import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../app.routes';
import { DemoSession } from '../../core/auth/demo-session';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import { BranchWorkspace } from '../branches/branch-workspace';
import { ADMIN_RUNTIME_CONFIG } from '../../core/config/admin-config';

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
const result = {
  data: {
    karmaCars: [
      {
        __typename: 'KarmaCar',
        id: '41',
        deviceId: '000123456789012',
        projectId: '12',
        carNumber: 'KARMA TEST 41',
        carType: null,
        carYear: '2020',
        carColor: '',
        timeZoneId: 8,
      },
    ],
  },
};

describe('authenticated global Karma workspace', () => {
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
      token: 'karma-session-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    for (const read of http.match((request) => operation(request, 'AdminKarmaReferences')))
      if (!read.cancelled) read.flush({ data: { karmaProjects: [], karmaTimeZones: [] } });
    for (const read of http.match((request) => operation(request, 'AdminKarmaLocation')))
      if (!read.cancelled) read.flush({ data: { karmaLocation: null } });
    http.verify({ ignoreCancelled: true });
  });

  it('loads truck details directly without a Branch header or list request', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/41');
    const read = http.expectOne((request) => operation(request, 'AdminKarmaCar'));
    expect(read.request.headers.has('x-branch-id')).toBe(false);
    expect(read.request.headers.get('authorization')).toBe('Bearer karma-session-a');
    expect(read.request.body).toMatchObject({ variables: { id: '41' } });
    read.flush({
      data: {
        karmaCar: {
          ...result.data.karmaCars[0],
          subType: 'Trailer',
          timeZoneId: 8,
          driverCount: 0,
        },
      },
    });
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    http.expectNone((request) => operation(request, 'AdminKarmaCars'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Truck details');
    expect(harness.routeNativeElement?.querySelector('dl')?.textContent).toContain(
      '000123456789012',
    );
    expect(harness.routeNativeElement?.querySelector('dl')?.textContent).toContain('Trailer');
  });

  it('retires detail reads across truck A → B → A, language changes and logout', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/41');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    let pending = http.expectOne((request) => operation(request, 'AdminKarmaCar'));
    for (const id of ['42', '41']) {
      await harness.navigateByUrl('/en/karma-client/cars/' + id);
      expect(pending.cancelled).toBe(true);
      pending = http.expectOne((request) => operation(request, 'AdminKarmaCar'));
      expect(pending.request.body).toMatchObject({ variables: { id } });
    }
    await harness.navigateByUrl('/bg/karma-client/cars/41');
    expect(pending.cancelled).toBe(true);
    pending = http.expectOne((request) => operation(request, 'AdminKarmaCar'));
    expect(pending.request.headers.get('Accept-Language')).toBe('bg');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    TestBed.inject(DemoSession).logout();
    await harness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminTenants'))
      .flush({ data: { tenants: [] } });
    http.expectNone((request) => operation(request, 'AdminKarmaCar'));
  });

  it('shows not-found for missing records and skips requests for malformed route IDs', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/999');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    http
      .expectOne((request) => operation(request, 'AdminKarmaCar'))
      .flush({ data: { karmaCar: null } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Truck not found in Karma.');
    await harness.navigateByUrl('/en/karma-client/cars/not-an-id');
    http.expectNone((request) => operation(request, 'AdminKarmaCar'));
    expect(harness.routeNativeElement?.textContent).toContain('Truck not found in Karma.');
  });

  it('loads without waiting for Branch discovery, with Fleet disabled and no Branch header', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars');
    const read = http.expectOne((request) => operation(request, 'AdminKarmaCars'));
    expect(read.request.headers.has('x-branch-id')).toBe(false);
    expect(read.request.headers.get('authorization')).toBe('Bearer karma-session-a');
    read.flush(result);
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Trucks');
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain(
      '000123456789012',
    );
    expect(harness.routeNativeElement?.textContent).not.toContain('No branches available');
  });

  it('keeps the global list accessible when Branch discovery fails', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ errors: [{ message: 'Branches unavailable' }] });
    http.expectOne((request) => operation(request, 'AdminKarmaCars')).flush(result);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('KARMA TEST 41');
    expect(harness.routeNativeElement?.textContent).not.toContain('Branches unavailable');
  });

  it('keeps the same route/client on Branch switching and retires reads on language changes', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars');
    const branch = '10000000-0000-4000-8000-000000000001';
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [{ id: branch, name: 'Branch A' }] } });
    await harness.fixture.whenStable();
    const workspace: unknown = harness.routeDebugElement?.componentInstance;
    if (!(workspace instanceof BranchWorkspace)) throw new Error('Missing BranchWorkspace');
    const old = http.expectOne((request) => operation(request, 'AdminKarmaCars'));
    workspace.chooseBranch(branch);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/en/karma-client/cars');
    expect(old.cancelled).toBe(false);
    http.expectNone((request) => operation(request, 'AdminKarmaCars'));
    await harness.navigateByUrl('/bg/karma-client/cars');
    expect(old.cancelled).toBe(true);
    const next = http.expectOne((request) => operation(request, 'AdminKarmaCars'));
    expect(next.request.headers.get('Accept-Language')).toBe('bg');
    expect(next.request.headers.has('x-branch-id')).toBe(false);
    next.flush(result);
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Камиони');
  });

  it('retires a pending read and creates fresh clients on session A → B → A', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    const old = http.expectOne((request) => operation(request, 'AdminKarmaCars'));
    const session = TestBed.inject(DemoSession);
    for (const token of ['karma-session-b', 'karma-session-a']) {
      session.start({
        token,
        tenant: { id: '01000000-0000-4000-8000-000000000002', name: 'Tenant' },
      });
      await harness.fixture.whenStable();
      expect(old.cancelled).toBe(true);
      const next = http.expectOne((request) => operation(request, 'AdminKarmaCars'));
      expect(next.request.headers.get('authorization')).toBe('Bearer ' + token);
      http
        .expectOne((request) => operation(request, 'AdminBranches'))
        .flush({ data: { branches: [] } });
      next.flush(result);
      await harness.fixture.whenStable();
    }
  });

  it('cancels pending reads on logout and issues no Karma requests while signed out', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    const pending = http.expectOne((request) => operation(request, 'AdminKarmaCars'));
    TestBed.inject(DemoSession).logout();
    await harness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminTenants'))
      .flush({ data: { tenants: [] } });
    http.expectNone((request) => operation(request, 'AdminKarmaCars'));
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).not.toBe('Trucks');
  });
});
