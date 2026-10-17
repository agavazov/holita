import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { Login } from '../features/auth/login';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../app.routes';
import { DemoSession } from '../core/auth/demo-session';
import { graphqlOptions } from '../core/graphql/graphql-options';
import { AdminWorkspace } from './admin-workspace';

const tenantA = { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' };
const tenantB = { id: '01000000-0000-4000-8000-000000000002', name: 'Other tenant' };
const branch = { id: '10000000-0000-4000-8000-000000000001', name: 'Branch' };
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    !!body && typeof body === 'object' && 'operationName' in body && body.operationName === name
  );
}
function loginScreen(harness: RouterTestingHarness): Login {
  const screen: unknown = harness.routeDebugElement?.query(By.directive(Login)).componentInstance;
  if (!(screen instanceof Login)) throw new Error('Missing Login');
  return screen;
}
describe('Demo tenant login workspace', () => {
  let http: HttpTestingController;
  let session: DemoSession;
  beforeEach(() => {
    sessionStorage.removeItem('holita.admin.demo-session');
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(DemoSession);
  });
  afterEach(() => {
    session.logout();
    http.verify({ ignoreCancelled: true });
  });
  it('gates a bookmarked business route until tenant login and resets clients during A → B → A', async () => {
    const harness = await RouterTestingHarness.create(`/en/${branch.id}/fleet/vehicles`);
    const discovery = http.expectOne((r) => operation(r, 'AdminTenants'));
    expect(discovery.request.headers.has('authorization')).toBe(false);
    discovery.flush({ data: { tenants: [tenantA, tenantB] } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Demo sign in');
    expect(harness.routeNativeElement?.querySelector('holita-admin-shell')).toBeNull();
    expect(loginScreen(harness).branchControl.disabled).toBe(true);
    http.expectNone((r) => operation(r, 'AdminBranches') || operation(r, 'AdminVehicles'));
    const workspace: unknown = harness.routeDebugElement?.componentInstance;
    if (!(workspace instanceof AdminWorkspace)) throw new Error('Missing AdminWorkspace');
    async function login(tenant: typeof tenantA, token: string) {
      const screen = loginScreen(harness);
      screen.tenantControl.setValue(tenant.id);
      const request = http.expectOne((r) => operation(r, 'AdminDemoLogin'));
      expect(request.request.body).toMatchObject({ variables: { tenantId: tenant.id } });
      request.flush({ data: { demoLogin: { token, tenant } } });
      await harness.fixture.whenStable();
      const branches = http.expectOne((r) => operation(r, 'AdminBranches'));
      expect(branches.request.headers.get('authorization')).toBe(`Bearer ${token}`);
      expect(TestBed.inject(DemoSession).current()).toBeNull();
      branches.flush({ data: { branches: [branch] } });
      await harness.fixture.whenStable();
      screen.branchControl.setValue(branch.id);
      screen.login();
      await harness.fixture.whenStable();
      http.expectOne((r) => operation(r, 'AdminBranches')).flush({ data: { branches: [branch] } });
      await harness.fixture.whenStable();
    }
    await login(tenantA, 'token-a');
    const retiredA = http.expectOne((r) => operation(r, 'AdminVehicles'));
    expect(retiredA.request.headers.get('authorization')).toBe('Bearer token-a');
    await workspace.logout();
    await harness.fixture.whenStable();
    expect(retiredA.cancelled).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/en');
    expect(workspace.branches.branches()).toBeNull();
    http
      .expectOne((r) => operation(r, 'AdminTenants'))
      .flush({ data: { tenants: [tenantA, tenantB] } });
    await login(tenantB, 'token-b');
    await harness.navigateByUrl(`/en/${branch.id}/fleet/vehicles`);
    const readB = http.expectOne((r) => operation(r, 'AdminVehicles'));
    expect(readB.request.headers.get('authorization')).toBe('Bearer token-b');
    readB.flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 20 } } });
    await harness.fixture.whenStable();
    await workspace.logout();
    await harness.fixture.whenStable();
    http
      .expectOne((r) => operation(r, 'AdminTenants'))
      .flush({ data: { tenants: [tenantA, tenantB] } });
    await login(tenantA, 'fresh-token-a');
    await harness.navigateByUrl(`/en/${branch.id}/fleet/vehicles`);
    const fresh = http.expectOne((r) => operation(r, 'AdminVehicles'));
    expect(fresh.request.headers.get('authorization')).toBe('Bearer fresh-token-a');
    fresh.flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 20 } } });
    await harness.fixture.whenStable();
  });
  it('keeps a failed login on the login screen without discovering branches', async () => {
    const harness = await RouterTestingHarness.create('/bg');
    http.expectOne((r) => operation(r, 'AdminTenants')).flush({ data: { tenants: [tenantA] } });
    await harness.fixture.whenStable();
    const workspace: unknown = harness.routeDebugElement?.componentInstance;
    if (!(workspace instanceof AdminWorkspace)) throw new Error('Missing workspace');
    loginScreen(harness).tenantControl.setValue(tenantA.id);
    http
      .expectOne((r) => operation(r, 'AdminDemoLogin'))
      .flush({ errors: [{ message: 'Login unavailable' }] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Login unavailable');
    expect(TestBed.inject(DemoSession).current()).toBeNull();
    http.expectNone((r) => operation(r, 'AdminBranches'));
  });
  it('ignores a late candidate token and cancels branch discovery when the tenant changes', async () => {
    const harness = await RouterTestingHarness.create('/en');
    http
      .expectOne((r) => operation(r, 'AdminTenants'))
      .flush({ data: { tenants: [tenantA, tenantB] } });
    await harness.fixture.whenStable();
    const screen = loginScreen(harness);
    screen.tenantControl.setValue(tenantA.id);
    const delayedA = http.expectOne((r) => operation(r, 'AdminDemoLogin'));
    screen.tenantControl.setValue(tenantB.id);
    const loginB = http.expectOne((r) => operation(r, 'AdminDemoLogin'));
    delayedA.flush({ data: { demoLogin: { token: 'old-a', tenant: tenantA } } });
    await harness.fixture.whenStable();
    http.expectNone((r) => operation(r, 'AdminBranches'));
    loginB.flush({ data: { demoLogin: { token: 'token-b', tenant: tenantB } } });
    await harness.fixture.whenStable();
    const branchesB = await vi.waitFor(() => http.expectOne((r) => operation(r, 'AdminBranches')));
    expect(branchesB.request.headers.get('authorization')).toBe('Bearer token-b');
    screen.tenantControl.setValue(tenantA.id);
    expect(branchesB.cancelled).toBe(true);
    expect(screen.branchControl.value).toBeNull();
    expect(screen.branchControl.disabled).toBe(true);
    screen.login();
    expect(TestBed.inject(DemoSession).current()).toBeNull();
    http
      .expectOne((r) => operation(r, 'AdminDemoLogin'))
      .flush({ data: { demoLogin: { token: 'fresh-a', tenant: tenantA } } });
    await harness.fixture.whenStable();
    http.expectOne((r) => operation(r, 'AdminBranches')).flush({ data: { branches: [branch] } });
    await harness.fixture.whenStable();
    expect(screen.branches()).toEqual([branch]);
    expect(TestBed.inject(DemoSession).current()).toBeNull();
  });

  it('requires a branch and retries discovery failures without activating a session', async () => {
    const harness = await RouterTestingHarness.create('/en');
    http.expectOne((r) => operation(r, 'AdminTenants')).flush({ data: { tenants: [tenantA] } });
    await harness.fixture.whenStable();
    const screen = loginScreen(harness);
    screen.tenantControl.setValue(tenantA.id);
    http
      .expectOne((r) => operation(r, 'AdminDemoLogin'))
      .flush({ data: { demoLogin: { token: 'a', tenant: tenantA } } });
    await harness.fixture.whenStable();
    http
      .expectOne((r) => operation(r, 'AdminBranches'))
      .flush({ errors: [{ message: 'Branches unavailable' }] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Branches unavailable');
    screen.login();
    expect(TestBed.inject(DemoSession).current()).toBeNull();
    screen.retry();
    http
      .expectOne((r) => operation(r, 'AdminDemoLogin'))
      .flush({ data: { demoLogin: { token: 'retry-a', tenant: tenantA } } });
    await harness.fixture.whenStable();
    http.expectOne((r) => operation(r, 'AdminBranches')).flush({ data: { branches: [] } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No branches available.');
    expect(screen.branchControl.disabled).toBe(true);
    expect(TestBed.inject(DemoSession).current()).toBeNull();
    http.expectNone((r) => operation(r, 'AdminVehicles'));
  });
  it('opens the login-selected Branch in Vehicles instead of a bookmarked editor from another Branch', async () => {
    const harness = await RouterTestingHarness.create(
      '/en/10000000-0000-4000-8000-000000000002/fleet/devices/new?search=old',
    );
    http.expectOne((r) => operation(r, 'AdminTenants')).flush({ data: { tenants: [tenantA] } });
    await harness.fixture.whenStable();
    const screen = loginScreen(harness);
    screen.tenantControl.setValue(tenantA.id);
    http
      .expectOne((r) => operation(r, 'AdminDemoLogin'))
      .flush({ data: { demoLogin: { token: 'chosen-a', tenant: tenantA } } });
    await harness.fixture.whenStable();
    http.expectOne((r) => operation(r, 'AdminBranches')).flush({ data: { branches: [branch] } });
    await harness.fixture.whenStable();
    screen.branchControl.setValue(branch.id);
    const form = harness.routeNativeElement?.querySelector<HTMLFormElement>('form');
    if (!form) throw new Error('Missing login form');
    expect(form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))).toBe(
      false,
    );
    await harness.fixture.whenStable();
    http.expectOne((r) => operation(r, 'AdminBranches')).flush({ data: { branches: [branch] } });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/en/${branch.id}/fleet/vehicles`);
    const read = http.expectOne((r) => operation(r, 'AdminVehicles'));
    expect(read.request.headers.get('x-branch-id')).toBe(branch.id);
    read.flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 20 } } });
    http.expectNone((r) => operation(r, 'AdminDevices'));
    expect(session.branchId()).toBe(branch.id);
  });
});
