import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { DemoSession } from '../../../core/auth/demo-session';
import { ADMIN_RUNTIME_CONFIG } from '../../../core/config/admin-config';
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
const user = {
  __typename: 'KarmaUser',
  id: '71',
  userName: 'fixture-000',
  active: 0,
  expireDate: null,
  roleId: '40',
  firstName: '<b>Fixture name</b>',
  lastName: '',
  timeZoneId: 0,
  email: 'fixture@example.test',
  projectId: '12',
  projectIds: ['12', '0'],
};
const role = { __typename: 'KarmaRole', id: '40', description: '<script>Viewer</script>' };
describe('Complete account views and read retirement', () => {
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
      token: 'phase4-a',
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
  it('shows eleven escaped source fields and preserves zero, null and original memberships', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/users');
    branches();
    read('AdminKarmaUsers').flush({ data: { karmaUsers: [user] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const button = harness.routeNativeElement?.querySelector<HTMLButtonElement>('td button');
    button?.click();
    harness.detectChanges();
    const fields = Array.from(harness.routeNativeElement?.querySelectorAll('dd') ?? []);
    expect(fields).toHaveLength(11);
    expect(fields.map((f) => f.textContent.trim())).toEqual([
      '71',
      'fixture-000',
      '0',
      '—',
      '40',
      '<b>Fixture name</b>',
      '—',
      '0',
      'fixture@example.test',
      '12',
      '12, 0',
    ]);
    expect(harness.routeNativeElement?.querySelector('dl b')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Active (source value)');
  });
  it('restores URL paging, searches all fields and retains rows on failed refresh', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/users?size=25&first=50');
    branches();
    read('AdminKarmaUsers').flush({
      data: {
        karmaUsers: Array.from({ length: 120 }, (_, i) => ({
          ...user,
          id: String(i + 71),
          userName: `user-${String(i)}`,
        })),
      },
    });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('tbody tr')?.textContent).toContain('121');
    const refresh = Array.from(
      harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((b) => b.textContent.includes('Refresh'));
    refresh?.click();
    await harness.fixture.whenStable();
    read('AdminKarmaUsers').flush({ errors: [{ message: 'Karma is unavailable' }] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Karma is unavailable');
    expect(harness.routeNativeElement?.querySelector('tbody tr')?.textContent).toContain('121');
    await TestBed.inject(Router).navigateByUrl('/en/karma-client/users?q=user-119');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('190');
    expect(harness.routeNativeElement?.querySelectorAll('tbody tr')).toHaveLength(1);
    http.expectNone((request) => operation(request, 'AdminKarmaUsers'));
  });
  it('retires pending account views on navigation and uses fresh clients on language/session changes', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/users');
    branches();
    const retired = read('AdminKarmaUsers');
    await harness.navigateByUrl('/en/karma-client/roles');
    expect(retired.cancelled).toBe(true);
    read('AdminKarmaRoles').flush({ data: { karmaRoles: [role] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain(
      '<script>Viewer</script>',
    );
    expect(harness.routeNativeElement?.querySelector('tbody script')).toBeNull();
    await harness.navigateByUrl('/bg/karma-client/roles');
    branches();
    const bg = read('AdminKarmaRoles');
    expect(bg.request.headers.get('accept-language')).toBe('bg');
    TestBed.inject(DemoSession).start({
      token: 'phase4-b',
      tenant: { id: '01000000-0000-4000-8000-000000000002', name: 'B' },
    });
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(bg.cancelled).toBe(true);
    branches();
    const fresh = read('AdminKarmaRoles');
    expect(fresh.request.headers.get('authorization')).toBe('Bearer phase4-b');
    fresh.flush({ data: { karmaRoles: [] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Роли');
  });
  it('handles empty users and prevents in-flight reads surviving logout', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/users');
    branches();
    read('AdminKarmaUsers').flush({ data: { karmaUsers: [] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No matching records.');
    await harness.navigateByUrl('/en/karma-client/roles');
    const retired = read('AdminKarmaRoles');
    TestBed.inject(DemoSession).logout();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(retired.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminTenants'))
      .flush({ data: { tenants: [] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('holita-roles-page')).toBeNull();
  });
});
