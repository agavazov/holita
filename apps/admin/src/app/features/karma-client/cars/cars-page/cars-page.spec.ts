import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../../../app.routes';
import { DemoSession } from '../../../../core/auth/demo-session';
import { ADMIN_RUNTIME_CONFIG } from '../../../../core/config/admin-config';
import { graphqlOptions } from '../../../../core/graphql/graphql-options';
import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import { CarsPage } from './cars-page';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
const cars = Array.from({ length: 61 }, (_, index) => ({
  __typename: 'KarmaCar',
  id: String(41 + index),
  deviceId: String(123456789012 + index).padStart(15, '0'),
  projectId: index % 2 === 0 ? '12' : '13',
  carNumber: `TRUCK ${String(41 + index)}`,
  carType: null,
  carYear: null,
  carColor: null,
  timeZoneId: 8,
}));

describe('Karma truck account search and pagination', () => {
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
      token: 'cars-session',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });

  async function open(query = '') {
    const harness = await RouterTestingHarness.create('/en/karma-client/cars' + query);
    http
      .expectOne((request) => operation(request, 'AdminBranches'))
      .flush({ data: { branches: [] } });
    http
      .expectOne((request) => operation(request, 'AdminKarmaReferences'))
      .flush({
        data: {
          karmaProjects: [{ __typename: 'KarmaProject', id: '12', name: 'International' }],
          karmaTimeZones: [{ __typename: 'KarmaTimeZone', id: 8, name: 'Europe/Sofia' }],
        },
      });
    const pending = http.expectOne((request) => operation(request, 'AdminKarmaCars'));
    expect(pending.request.headers.has('x-branch-id')).toBe(false);
    pending.flush({ data: { karmaCars: cars } });
    await harness.fixture.whenStable();
    const component: unknown = harness.fixture.debugElement.query(
      By.directive(CarsPage),
    ).componentInstance;
    if (!(component instanceof CarsPage)) {
      throw new Error('Missing truck list');
    }
    return { harness, component };
  }

  it('keeps the list catalogs in parity', () => {
    expectCatalogParity(bg, en);
  });

  it('pages the full loaded account and retains the query across reload-style navigation', async () => {
    const { component, harness } = await open('?size=25&first=50');
    expect(component.filtered()).toHaveLength(61);
    expect(component.first()).toBe(50);
    expect(harness.routeNativeElement?.querySelectorAll('tbody tr')).toHaveLength(11);
    expect(harness.routeNativeElement?.querySelector('tbody tr')?.textContent).toContain(
      'TRUCK 91',
    );
    component.page({ first: 25, rows: 25 });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('first=25');
    expect(component.first()).toBe(25);
    expect(harness.routeNativeElement?.querySelector('tbody tr')?.textContent).toContain(
      'TRUCK 66',
    );
    http.expectNone((request) => operation(request, 'AdminKarmaCars'));
  });

  it('searches registration, ID and leading-zero device IDs locally and resets the page', async () => {
    const { component, harness } = await open('?size=25&first=50');
    for (const [value, id] of [
      ['truck 41', '41'],
      ['101', '101'],
      ['000123456789012', '41'],
    ] as const) {
      component.form.setValue({ search: value, project: null });
      component.applySearch();
      await harness.fixture.whenStable();
      expect(component.filtered().map((car) => car.id)).toEqual([id]);
      expect(component.first()).toBe(0);
      expect(TestBed.inject(Router).url).not.toContain('first=');
    }
    http.expectNone((request) => operation(request, 'AdminKarmaCars'));
  });

  it('combines project and search, distinguishes no matches and clears without refetching', async () => {
    const { component, harness } = await open('?project=12&size=25&first=500');
    expect(component.filtered()).toHaveLength(31);
    expect(component.first()).toBe(25);
    expect(component.projectOptions().find((option) => option.value === '12')?.label).toBe(
      'International (12)',
    );
    component.form.setValue({ search: 'TRUCK 42', project: '12' });
    component.applySearch();
    await harness.fixture.whenStable();
    expect(component.filtered()).toHaveLength(0);
    expect(harness.routeNativeElement?.textContent).toContain(en.noMatches);
    component.clearSearch();
    await harness.fixture.whenStable();
    expect(component.filtered()).toHaveLength(61);
    expect(component.query().rows).toBe(25);
    expect(component.first()).toBe(0);
    expect(TestBed.inject(Router).url).not.toMatch(/project=|q=/);
    http.expectNone((request) => operation(request, 'AdminKarmaCars'));
  });

  it('clamps the visible page after refresh returns fewer records', async () => {
    const { component, harness } = await open('?size=25&first=50');
    component.refresh();
    http
      .expectOne((request) => operation(request, 'AdminKarmaReferences'))
      .flush({ data: { karmaProjects: [], karmaTimeZones: [] } });
    http
      .expectOne((request) => operation(request, 'AdminKarmaCars'))
      .flush({ data: { karmaCars: cars.slice(0, 2) } });
    await harness.fixture.whenStable();
    expect(component.first()).toBe(0);
    expect(harness.routeNativeElement?.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});
