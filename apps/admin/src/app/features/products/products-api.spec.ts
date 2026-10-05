import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProductsPage } from './products-page';
import type { AdminProductFragment } from '../../../generated/graphql/operations';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const productA: AdminProductFragment = {
  id: '20000000-0000-4000-8000-000000000001',
  storeId: storeA,
  name: 'Sofia notebook',
  sku: 'NOTEBOOK',
  status: 'DRAFT',
};
const productB: AdminProductFragment = {
  id: '20000000-0000-4000-8000-000000000002',
  storeId: storeB,
  name: 'Plovdiv notebook',
  sku: 'NOTEBOOK',
  status: 'ACTIVE',
};

function operation(request: HttpRequest<unknown>, name: string, storeId: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-store-id') === storeId &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function productPage(product: AdminProductFragment) {
  return {
    data: {
      products: {
        __typename: 'ProductPage',
        items: [{ ...product, __typename: 'Product' }],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}

describe('Products Apollo scope', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });

  function mount(storeId: string) {
    const fixture = TestBed.createComponent(ProductsPage);
    fixture.componentRef.setInput('store', {
      id: storeId,
      name: storeId === storeA ? 'Sofia' : 'Plovdiv',
    });
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    return fixture;
  }

  it('separates concurrent identical list queries, entity caches and request headers', async () => {
    const a = mount(storeA);
    const b = mount(storeB);
    const readA = http.expectOne((request) => operation(request, 'AdminProducts', storeA));
    const readB = http.expectOne((request) => operation(request, 'AdminProducts', storeB));
    expect(readA.request.headers.get('x-request-id')).not.toBe(
      readB.request.headers.get('x-request-id'),
    );
    expect(readB.request.headers.get('Accept-Language')).toBe('en');
    readB.flush(productPage(productB));
    readA.flush(productPage(productA));
    await a.whenStable();
    await b.whenStable();
    expect(a.componentInstance.page()?.items[0]?.storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.storeId).toBe(storeB);
    a.destroy();
    b.destroy();
  });

  it('keeps a submitted mutation alive after A is destroyed and never invalidates B or a new A', async () => {
    const a = mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminProducts', storeA))
      .flush(productPage(productA));
    await a.whenStable();
    const oldApi = a.componentInstance.api;
    const mutation = oldApi.update({ id: productA.id, input: { name: 'Saved in old A' } });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateProduct', storeA));
    a.destroy();
    const b = mount(storeB);
    http
      .expectOne((request) => operation(request, 'AdminProducts', storeB))
      .flush(productPage(productB));
    await b.whenStable();
    const newA = mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminProducts', storeA))
      .flush(productPage(productA));
    await newA.whenStable();
    expect(write.cancelled).toBe(false);
    write.flush({
      data: { updateProduct: { ...productA, __typename: 'Product', name: 'Saved in old A' } },
    });
    expect((await mutation).storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.name).toBe(productB.name);
    expect(newA.componentInstance.page()?.items[0]?.name).toBe(productA.name);
    http.expectNone('/graphql');
    await expect(
      oldApi.update({ id: productA.id, input: { name: 'Obsolete write' } }),
    ).rejects.toThrow('active Products workspace');
    b.destroy();
    newA.destroy();
  });

  it('releases a retired client after a failed mutation without changing the new store', async () => {
    const a = mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminProducts', storeA))
      .flush(productPage(productA));
    await a.whenStable();
    const mutation = a.componentInstance.api.update({
      id: productA.id,
      input: { sku: 'DUPLICATE' },
    });
    const rejection = expect(mutation).rejects.toThrow('SKU conflict');
    const write = http.expectOne((request) => operation(request, 'AdminUpdateProduct', storeA));
    a.destroy();
    const b = mount(storeB);
    http
      .expectOne((request) => operation(request, 'AdminProducts', storeB))
      .flush(productPage(productB));
    await b.whenStable();
    write.flush({
      errors: [
        { message: 'SKU conflict', extensions: { code: 'CONFLICT', requestId: 'failed-write' } },
      ],
    });
    await rejection;
    expect(b.componentInstance.error()).toBeNull();
    expect(b.componentInstance.page()?.items[0]?.storeId).toBe(storeB);
    http.expectNone('/graphql');
    b.destroy();
  });

  it('retains loaded rows on a GraphQL refresh error and recovers with a new request ID', async () => {
    const a = mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminProducts', storeA))
      .flush(productPage(productA));
    await a.whenStable();
    a.componentInstance.refresh();
    const failed = http.expectOne('/graphql');
    failed.flush({
      errors: [
        {
          message: 'Products unavailable',
          extensions: { code: 'SERVICE_UNAVAILABLE', requestId: 'refresh-id' },
        },
      ],
    });
    await a.whenStable();
    expect(a.componentInstance.page()?.items[0]?.name).toBe(productA.name);
    expect(a.componentInstance.failure()).toContain('Products unavailable (refresh-id)');
    a.componentInstance.refresh();
    const retry = http.expectOne('/graphql');
    expect(retry.request.headers.get('x-request-id')).not.toBe(
      failed.request.headers.get('x-request-id'),
    );
    retry.flush(productPage(productA));
    await a.whenStable();
    expect(a.componentInstance.error()).toBeNull();
    a.destroy();
  });
});
