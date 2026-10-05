import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../app.routes';
import { graphqlOptions } from '../../core/graphql/graphql-options';

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

function products(storeId: string, name: string) {
  return {
    data: {
      products: {
        __typename: 'ProductPage',
        total: 1,
        offset: 0,
        limit: 20,
        items: [
          {
            __typename: 'Product',
            id: storeId.replace('1000', '2000'),
            storeId,
            name,
            sku: 'NOTEBOOK',
            status: 'DRAFT',
          },
        ],
      },
    },
  };
}

describe('Angular store routing', () => {
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
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });

  it('recreates the store boundary during A → B → A while Angular reuses the parameterized route', async () => {
    const harness = await RouterTestingHarness.create('/en');
    const discovery = http.expectOne((request) => operation(request, 'AdminStores'));
    expect(discovery.request.headers.has('x-store-id')).toBe(false);
    discovery.flush({ data: { stores } });
    await harness.fixture.whenStable();
    await harness.navigateByUrl(`/en/stores/${storeA}/products`);
    const pendingA = http.expectOne((request) => operation(request, 'AdminProducts'));
    expect(pendingA.request.headers.get('x-store-id')).toBe(storeA);
    await harness.navigateByUrl(`/en/stores/${storeB}/products`);
    expect(pendingA.cancelled).toBe(true);
    const readB = http.expectOne((request) => operation(request, 'AdminProducts'));
    expect(readB.request.headers.get('x-store-id')).toBe(storeB);
    readB.flush(products(storeB, 'B only'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('B only');
    await harness.navigateByUrl(`/en/stores/${storeA}/products`);
    const freshA = http.expectOne((request) => operation(request, 'AdminProducts'));
    expect(freshA.request.headers.get('x-store-id')).toBe(storeA);
    expect(harness.routeNativeElement?.textContent).not.toContain('B only');
    freshA.flush(products(storeA, 'Fresh A'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Fresh A');
    expect(harness.routeNativeElement?.textContent).not.toContain('B only');
  });

  it('shows empty and unavailable stores without issuing business queries', async () => {
    const harness = await RouterTestingHarness.create('/en');
    http.expectOne((request) => operation(request, 'AdminStores')).flush({ data: { stores: [] } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No stores available.');
    http.expectNone('/graphql');
    await harness.navigateByUrl('/en/stores/not-a-uuid/products');
    http.expectNone('/graphql');
  });

  it('blocks an unknown store and preserves loaded discovery on a refresh failure', async () => {
    const harness = await RouterTestingHarness.create('/en/stores/not-a-uuid/products');
    http.expectOne((request) => operation(request, 'AdminStores')).flush({ data: { stores } });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Store not found');
    http.expectNone('/graphql');
    const refresh = harness.routeNativeElement?.querySelector('button');
    if (!refresh) throw new Error('Missing discovery refresh control.');
    refresh.click();
    http.expectOne('/graphql').flush({ errors: [{ message: 'Discovery unavailable' }] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Discovery unavailable');
    expect(harness.routeNativeElement?.textContent).toContain('Plovdiv');
  });
});
