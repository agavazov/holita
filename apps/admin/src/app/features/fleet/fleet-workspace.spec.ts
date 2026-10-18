import { DemoSession } from '../../core/auth/demo-session';
import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../app.routes';
import { ADMIN_RUNTIME_CONFIG } from '../../core/config/admin-config';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import { AdminShell } from '../../layout/admin-shell';

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
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true });
  });
  async function mount(url = path) {
    TestBed.inject(DemoSession).start({
      token: 'test-demo-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' },
    });
    http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create(url);
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    return harness;
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
    expect(TestBed.inject(Router).url).toBe(`/en/${branchA}/fleet/vehicles`);
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
    expect(harness.routeNativeElement?.querySelector('aside nav h2')?.textContent).toContain(
      'Fleet',
    );
    expect(
      harness.routeNativeElement
        ?.querySelector(`holita-admin-sidebar a[href$="/fleet/${resource}"]`)
        ?.getAttribute('href'),
    ).toBe(path);
    const oldRead = http.expectOne((request) => operation(request, listOperation));
    const shell: unknown = harness.routeDebugElement?.query(
      By.directive(AdminShell),
    ).componentInstance;
    if (!(shell instanceof AdminShell)) throw new Error('Missing shell.');
    shell.chooseBranch(branchB);
    await harness.fixture.whenStable();
    expect(oldRead.cancelled).toBe(true);
    expect(TestBed.inject(Router).url).toBe(path.replace(branchA, branchB));
    const readB = http.expectOne(
      (request) =>
        operation(request, listOperation) && request.headers.get('x-branch-id') === branchB,
    );
    expect(readB.request.headers.get('x-branch-id')).toBe(branchB);
    expect(readB.request.body).toMatchObject({ variables: { offset: 0, limit: 20 } });
    readB.flush(empty);
    await harness.fixture.whenStable();
    const retiredReads = http.match(
      (request) =>
        operation(request, listOperation) && request.headers.get('x-branch-id') === branchA,
    );
    expect(retiredReads.every((read) => read.cancelled)).toBe(true);
    shell.chooseBranch(branchA);
    await harness.fixture.whenStable();
    const freshA = http.expectOne(
      (request) =>
        operation(request, listOperation) && request.headers.get('x-branch-id') === branchA,
    );
    expect(freshA.request.headers.get('x-branch-id')).toBe(branchA);
    freshA.flush(empty);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(path);
  });
});
