import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../../../app.routes';
import { DemoSession } from '../../../../core/auth/demo-session';
import { ADMIN_RUNTIME_CONFIG } from '../../../../core/config/admin-config';
import { graphqlOptions } from '../../../../core/graphql/graphql-options';
import { EdataPage } from './edata-page';

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
  deviceId: '000123456789012',
  projectId: '12',
  carNumber: 'KARMA TEST 41',
  carType: null,
  carYear: null,
  carColor: null,
  subType: null,
  timeZoneId: null,
  driverCount: 0,
};
const message = {
  __typename: 'KarmaEdataMessage',
  id: '3000000600',
  carId: '41',
  deviceId: '000123456789012',
  carNumber: 'KARMA TEST 41',
  eventTimeUtc: '2026-01-01 09:59:00',
  eventTimeLocal: '2026-01-01 11:59:00',
  pdt: null,
  spd: 0,
  odo: 0,
  latitude: 0,
  longitude: null,
  parameters: [{ __typename: 'KarmaEdataParameter', id: '99999', value: 0, description: null }],
};
const result = {
  data: {
    karmaEdata: {
      __typename: 'KarmaEdataPage',
      hasMore: true,
      cursor: 'fixture_current',
      nextCursor: 'fixture_next',
      items: [message],
    },
  },
};

describe('Karma eData page', () => {
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
    http.verify({ ignoreCancelled: true });
  });
  async function open(url = '/en/karma-client/cars/41/edata') {
    const harness = await RouterTestingHarness.create(url);
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    http
      .expectOne((request) => operation(request, 'AdminKarmaCar'))
      .flush({ data: { karmaCar: car } });
    await harness.fixture.whenStable();
    return harness;
  }
  function component(harness: RouterTestingHarness): EdataPage {
    const value: unknown = harness.fixture.debugElement.query(
      By.directive(EdataPage),
    ).componentInstance;
    if (!(value instanceof EdataPage)) {
      throw new Error('Missing eData page');
    }
    return value;
  }
  function read() {
    return http.expectOne((request) => operation(request, 'AdminKarmaEdata'));
  }

  it('loads the latest 50 without dates or Branch scope and preserves every field in the dialog', async () => {
    const harness = await open();
    const request = read();
    expect(request.request.headers.has('x-branch-id')).toBe(false);
    expect(request.request.headers.get('authorization')).toBe('Bearer karma-session-a');
    expect(request.request.body).toMatchObject({
      variables: {
        input: {
          carId: '41',
          pageSize: 50,
          fromDate: null,
          toDate: null,
          cursor: null,
          parameterIds: [],
        },
      },
    });
    request.flush(result);
    await harness.fixture.whenStable();
    const view = component(harness);
    view.view(message);
    await harness.fixture.whenStable();
    const dialog = harness.routeNativeElement?.querySelector('[role="dialog"]');
    if (!dialog) {
      throw new Error('Missing message dialog');
    }
    expect(dialog.textContent).toContain('000123456789012');
    expect(dialog.textContent).toContain('99999');
    expect(dialog.textContent).toContain('2026-01-01 11:59:00');
    expect(dialog.querySelector('tbody')?.textContent).toContain('0');
    expect(dialog.querySelectorAll('dd')).toHaveLength(11);
    expect([...dialog.querySelectorAll('dd')].map((value: Element) => value.textContent)).toEqual([
      '3000000600',
      '41',
      'KARMA TEST 41',
      '000123456789012',
      '2026-01-01 09:59:00',
      '2026-01-01 11:59:00',
      '—',
      '0',
      '0',
      '0',
      '—',
    ]);
  });

  it('uses cursor history for Older/Newer and clears old rows while navigating', async () => {
    const harness = await open();
    read().flush(result);
    await harness.fixture.whenStable();
    component(harness).older();
    await harness.fixture.whenStable();
    expect(component(harness).page()).toBeNull();
    const older = read();
    expect(older.request.body).toMatchObject({ variables: { input: { cursor: 'fixture_next' } } });
    older.flush({
      data: {
        karmaEdata: { ...result.data.karmaEdata, items: [{ ...message, id: '3000000550' }] },
      },
    });
    await harness.fixture.whenStable();
    component(harness).newer();
    await harness.fixture.whenStable();
    expect(read().request.body).toMatchObject({
      variables: { input: { cursor: 'fixture_current' } },
    });
  });

  it('retires obsolete reads on URL filters, truck, language, session replacement and logout', async () => {
    const harness = await open();
    let pending = read();
    await harness.navigateByUrl(
      '/en/karma-client/cars/41/edata?size=25&parameters=1,99999&from=2026-01-01T00:00:00&to=2026-01-01T00:00:00',
    );
    expect(pending.cancelled).toBe(true);
    pending = read();
    expect(pending.request.body).toMatchObject({
      variables: {
        input: {
          pageSize: 25,
          parameterIds: ['1', '99999'],
          fromDate: '2026-01-01T00:00:00Z',
          toDate: '2026-01-01T00:00:00Z',
        },
      },
    });
    await harness.navigateByUrl('/en/karma-client/cars/42/edata');
    expect(pending.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminKarmaCar'))
      .flush({ data: { karmaCar: { ...car, id: '42' } } });
    await harness.fixture.whenStable();
    pending = read();
    await harness.navigateByUrl('/bg/karma-client/cars/42/edata');
    expect(pending.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    http
      .expectOne((request) => operation(request, 'AdminKarmaCar'))
      .flush({ data: { karmaCar: { ...car, id: '42' } } });
    await harness.fixture.whenStable();
    pending = read();
    expect(pending.request.headers.get('Accept-Language')).toBe('bg');
    TestBed.inject(DemoSession).start({
      token: 'karma-session-b',
      tenant: { id: '01000000-0000-4000-8000-000000000002', name: 'Tenant B' },
    });
    await harness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    http
      .expectOne((request) => operation(request, 'AdminKarmaCar'))
      .flush({ data: { karmaCar: { ...car, id: '42' } } });
    await harness.fixture.whenStable();
    pending = read();
    expect(pending.request.headers.get('authorization')).toBe('Bearer karma-session-b');
    TestBed.inject(DemoSession).logout();
    await harness.fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminTenants'))
      .flush({ data: { tenants: [] } });
  });

  it('retains rows after same-page refresh failure and recovers with Retry', async () => {
    const harness = await open();
    read().flush(result);
    await harness.fixture.whenStable();
    const view = component(harness);
    view.refresh();
    await harness.fixture.whenStable();
    read().flush({ errors: [{ message: 'Unavailable' }] });
    await harness.fixture.whenStable();
    expect(view.error()).toBe(true);
    expect(view.page()?.items[0]?.id).toBe('3000000600');
    view.refresh();
    await harness.fixture.whenStable();
    read().flush({
      data: {
        karmaEdata: { ...result.data.karmaEdata, items: [], hasMore: false, nextCursor: null },
      },
    });
    await harness.fixture.whenStable();
    expect(view.error()).toBe(false);
    expect(harness.routeNativeElement?.textContent).toContain(
      'No eData messages for these filters.',
    );
  });

  it('rejects malformed URL/form filters and clears the cursor when applying new filters', async () => {
    const harness = await open('/en/karma-client/cars/41/edata?from=2026-01-01T00:00:00');
    http.expectNone((request) => operation(request, 'AdminKarmaEdata'));
    const view = component(harness);
    expect(view.invalidFilters()).toBe(true);
    view.form.patchValue({ from: '', parameters: '0' });
    view.apply();
    await harness.fixture.whenStable();
    expect(view.formError()).toBe(true);
    http.expectNone((request) => operation(request, 'AdminKarmaEdata'));
    view.form.patchValue({ size: 100, parameters: '1,99999' });
    view.apply();
    await harness.fixture.whenStable();
    const request = read();
    expect(request.request.body).toMatchObject({
      variables: { input: { pageSize: 100, parameterIds: ['1', '99999'], cursor: null } },
    });
    request.flush(result);
  });

  it('skips eData for missing trucks and invalid IDs', async () => {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars/999/edata');
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    http
      .expectOne((request) => operation(request, 'AdminKarmaCar'))
      .flush({ data: { karmaCar: null } });
    await harness.fixture.whenStable();
    http.expectNone((request) => operation(request, 'AdminKarmaEdata'));
    expect(harness.routeNativeElement?.textContent).toContain('Truck not found');
    await harness.navigateByUrl('/en/karma-client/cars/invalid/edata');
    http.expectNone((request) => operation(request, 'AdminKarmaCar'));
    http.expectNone((request) => operation(request, 'AdminKarmaEdata'));
  });
});
