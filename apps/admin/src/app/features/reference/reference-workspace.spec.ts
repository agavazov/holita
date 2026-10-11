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

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const stores = [
  { id: storeA, name: 'Sofia' },
  { id: storeB, name: 'Plovdiv' },
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
])('Reference %s availability and workspace routing', (resource, entity) => {
  const path = `/en/stores/${storeA}/reference/${resource}`;
  const listOperation = `Admin${entity}s`;
  const empty = {
    data: {
      [`reference${entity}s`]: {
        __typename: `Reference${entity}Page`,
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
    http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create(url);
    http.expectOne((request) => operation(request, 'AdminStores')).flush({ data: { stores } });
    await harness.fixture.whenStable();
    return harness;
  }
  it('blocks all business routes and navigation when disabled while leaving store discovery usable', async () => {
    TestBed.overrideProvider(ADMIN_RUNTIME_CONFIG, {
      useValue: { graphqlUrl: '/graphql', referenceEnabled: false },
    });
    const harness = await mount();
    for (const suffix of ['', '/new', '/20000000-0000-4000-8000-000000000001/edit']) {
      await harness.navigateByUrl(path + suffix);
      expect(harness.routeNativeElement?.textContent).toContain('Reference is unavailable.');
      expect(
        harness.routeNativeElement?.querySelector(
          `holita-admin-navigation a[href*="reference/${resource}"]`,
        ),
      ).toBeNull();
      http.expectNone('/graphql');
    }
    await harness.navigateByUrl('/en');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent.trim()).toBe('Stores');
    http.expectNone('/graphql');
  }, 15000);
  it('does not issue business requests for unknown stores', async () => {
    const harness = await mount(`/en/stores/not-a-store/reference/${resource}/new`);
    expect(harness.routeNativeElement?.textContent).toContain('Store not found');
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    http.expectNone('/graphql');
  });
  it('keeps the Reference section, resets query context and cancels reads during A → B → A', async () => {
    const harness = await mount(path + '?search=old&page=2');
    const oldRead = http.expectOne((request) => operation(request, listOperation));
    const shell: unknown = harness.routeDebugElement?.query(
      By.directive(AdminShell),
    ).componentInstance;
    if (!(shell instanceof AdminShell)) throw new Error('Missing shell.');
    shell.storeControl.setValue(storeB);
    await harness.fixture.whenStable();
    expect(oldRead.cancelled).toBe(true);
    expect(TestBed.inject(Router).url).toBe(path.replace(storeA, storeB));
    const readB = http.expectOne(
      (request) =>
        operation(request, listOperation) && request.headers.get('x-store-id') === storeB,
    );
    expect(readB.request.headers.get('x-store-id')).toBe(storeB);
    expect(readB.request.body).toMatchObject({ variables: { offset: 0, limit: 20 } });
    readB.flush(empty);
    await harness.fixture.whenStable();
    const retiredReads = http.match(
      (request) =>
        operation(request, listOperation) && request.headers.get('x-store-id') === storeA,
    );
    expect(retiredReads.every((read) => read.cancelled)).toBe(true);
    shell.storeControl.setValue(storeA);
    await harness.fixture.whenStable();
    const freshA = http.expectOne(
      (request) =>
        operation(request, listOperation) && request.headers.get('x-store-id') === storeA,
    );
    expect(freshA.request.headers.get('x-store-id')).toBe(storeA);
    freshA.flush(empty);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(path);
  });
});
