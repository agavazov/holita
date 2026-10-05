import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../app.routes';
import { graphqlOptions } from '../../core/graphql/graphql-options';
import { ProductsPage } from './products-page';

const store = '10000000-0000-4000-8000-000000000001';
const path = `/en/stores/${store}/products`;

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function products(name: string, total = 50, offset = 0, limit = 20) {
  return {
    data: {
      products: {
        __typename: 'ProductPage',
        total,
        offset,
        limit,
        items: [
          {
            __typename: 'Product',
            id: crypto.randomUUID(),
            storeId: store,
            name,
            sku: name,
            status: 'ACTIVE',
          },
        ],
      },
    },
  };
}

describe('Products list URL and requests', () => {
  let http: HttpTestingController;
  let router: Router;
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
    router = TestBed.inject(Router);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });

  async function mount(query = '') {
    const harness = await RouterTestingHarness.create(path + query);
    http
      .expectOne((request) => operation(request, 'AdminStores'))
      .flush({ data: { stores: [{ id: store, name: 'Sofia' }] } });
    await harness.fixture.whenStable();
    const instance: unknown = harness.routeDebugElement?.query(
      By.directive(ProductsPage),
    ).componentInstance;
    if (!(instance instanceof ProductsPage) || !harness.routeNativeElement)
      throw new Error('Missing Products page.');
    return { harness, page: instance, element: harness.routeNativeElement };
  }

  it('keeps a bookmarked page while total is unknown and sends generated server variables', async () => {
    const { harness, element } = await mount('?page=3');
    const read = http.expectOne((request) => operation(request, 'AdminProducts'));
    expect(read.request.body).toMatchObject({
      variables: { offset: 40, limit: 20, sort: { field: 'CREATED_AT', direction: 'DESC' } },
    });
    expect(router.url).toBe(path + '?page=3');
    expect(element.querySelector('p-paginator')).toBeNull();
    read.flush(products('Third page', 50, 40));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=3');
    expect(element.querySelector('tbody')?.textContent).toContain('Third page');
    expect(element.querySelector('p-paginator [aria-current="page"]')?.textContent.trim()).toBe(
      '3',
    );
    http.expectNone('/graphql');
  });

  it('normalizes unsafe URL values once without losing unrelated parameters or the fragment', async () => {
    const { harness } = await mount(
      '?page=-2&pageSize=999&status=BAD&sort=unknown&order=desc&search=%20note%20&keep=yes#anchor',
    );
    const read = http.expectOne((request) => operation(request, 'AdminProducts'));
    expect(read.request.body).toMatchObject({
      variables: {
        offset: 0,
        limit: 20,
        search: 'note',
        sort: { field: 'CREATED_AT', direction: 'DESC' },
      },
    });
    read.flush(products('note'));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?search=note&keep=yes#anchor');
    http.expectNone('/graphql');
  });

  it('bounds GraphQL Int offsets and filters by Unicode code points before issuing a request', async () => {
    const { harness } = await mount(
      '?page=999999999999&pageSize=100&search=' +
        encodeURIComponent('😀'.repeat(201)) +
        '&sku=' +
        encodeURIComponent('SKU\u0000'),
    );
    const read = http.expectOne('/graphql');
    expect(read.request.body).toMatchObject({
      variables: { offset: 2147483600, limit: 100, search: '😀'.repeat(200), sku: 'SKU' },
    });
    read.flush({
      data: {
        products: {
          __typename: 'ProductPage',
          items: [],
          total: 0,
          offset: 2147483600,
          limit: 100,
        },
      },
    });
    await harness.fixture.whenStable();
    http.expectOne('/graphql').flush({
      data: {
        products: { __typename: 'ProductPage', items: [], total: 0, offset: 0, limit: 100 },
      },
    });
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
  });

  it('corrects an unavailable page only after the server supplies its total', async () => {
    const { harness } = await mount('?page=4');
    const read = http.expectOne('/graphql');
    expect(router.url).toBe(path + '?page=4');
    read.flush({
      data: {
        products: { __typename: 'ProductPage', items: [], total: 50, offset: 60, limit: 20 },
      },
    });
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=3');
    const last = http.expectOne('/graphql');
    expect(last.request.body).toMatchObject({ variables: { offset: 40, limit: 20 } });
    last.flush(products('Last page', 50, 40));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
  });

  it('does not correct a revisited page from an obsolete cached total', async () => {
    const { harness, element } = await mount('?page=4');
    http.expectOne('/graphql').flush({
      data: {
        products: { __typename: 'ProductPage', items: [], total: 50, offset: 60, limit: 20 },
      },
    });
    await harness.fixture.whenStable();
    http.expectOne('/graphql').flush(products('Last page', 50, 40));
    await harness.fixture.whenStable();
    await harness.navigateByUrl(path + '?page=4');
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=4');
    expect(element.querySelector('p-paginator')).toBeNull();
    const read = http.expectOne('/graphql');
    expect(read.cancelled).toBe(false);
    read.flush(products('Newly available page', 80, 60));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=4');
    expect(element.querySelector('tbody')?.textContent).toContain('Newly available page');
    http.expectNone('/graphql');
  });

  it('clears uncommitted drafts even when the applied URL is already unfiltered', async () => {
    const { harness, page, element } = await mount();
    http.expectOne('/graphql').flush(products('Initial'));
    await harness.fixture.whenStable();
    page.editText('search', 'pending search');
    page.editText('sku', 'pending SKU');
    page.clearFilters();
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path);
    expect(element.querySelector<HTMLInputElement>('#product-search')?.value).toBe('');
    expect(element.querySelector<HTMLInputElement>('#product-sku')?.value).toBe('');
    http.expectNone('/graphql');
  });

  it('commits pending text with an immediate status change and never restores cleared filters', async () => {
    const { harness, page, element } = await mount(
      '?page=2&pageSize=10&sort=sku&order=desc&keep=yes#anchor',
    );
    http
      .expectOne((request) => operation(request, 'AdminProducts'))
      .flush(products('First', 30, 10, 10));
    await harness.fixture.whenStable();
    const search = element.querySelector<HTMLInputElement>('#product-search');
    if (!search) throw new Error('Missing search input.');
    search.value = 'note';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
    page.changeStatus('ACTIVE');
    await harness.fixture.whenStable();
    const filtered = http.expectOne((request) => operation(request, 'AdminProducts'));
    expect(filtered.request.body).toMatchObject({
      variables: {
        offset: 0,
        limit: 10,
        search: 'note',
        status: 'ACTIVE',
        sort: { field: 'SKU', direction: 'DESC' },
      },
    });
    filtered.flush(products('Filtered', 20, 0, 10));
    await harness.fixture.whenStable();
    page.editText('sku', 'pending');
    page.clearFilters();
    await harness.fixture.whenStable();
    const cleared = http.expectOne((request) => operation(request, 'AdminProducts'));
    expect(cleared.request.body).toMatchObject({
      variables: { offset: 0, limit: 10, sort: { field: 'SKU', direction: 'DESC' } },
    });
    cleared.flush(products('Clear', 20, 0, 10));
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?pageSize=10&sort=sku&order=desc&keep=yes#anchor');
    expect(page.search()).toBe('');
    expect(page.sku()).toBe('');
    http.expectNone('/graphql');
  });

  it('debounces text, resets the page and recovers an empty filtered result', async () => {
    const { harness, page, element } = await mount('?page=2');
    http.expectOne('/graphql').flush(products('Initial', 50, 20));
    await harness.fixture.whenStable();
    page.editText('search', 'unmatched');
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=2');
    http.expectNone('/graphql');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    const read = http.expectOne('/graphql');
    expect(router.url).toBe(path + '?search=unmatched');
    read.flush({
      data: { products: { __typename: 'ProductPage', items: [], total: 0, offset: 0, limit: 20 } },
    });
    await harness.fixture.whenStable();
    expect(element.querySelector('tbody')?.textContent).toContain(
      'No products match these filters.',
    );
  });

  it('restores URL drafts on navigation and cancels the uncommitted debounce', async () => {
    const { harness, page, element } = await mount('?status=ACTIVE');
    http.expectOne('/graphql').flush(products('Active'));
    await harness.fixture.whenStable();
    page.editText('search', 'obsolete draft');
    await harness.navigateByUrl(path + '?status=DRAFT');
    http.expectOne('/graphql').flush(products('Draft'));
    await harness.fixture.whenStable();
    expect(page.search()).toBe('');
    expect(element.querySelector<HTMLInputElement>('#product-search')?.value).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?status=DRAFT');
    http.expectNone('/graphql');
  });

  it('disposes an old query and ignores its aborted refresh after filters change', async () => {
    const { harness, page, element } = await mount();
    http.expectOne('/graphql').flush(products('Old rows'));
    await harness.fixture.whenStable();
    page.refresh();
    const oldRefresh = http.expectOne('/graphql');
    await harness.navigateByUrl(path + '?status=DRAFT');
    const current = http.expectOne('/graphql');
    expect(oldRefresh.cancelled).toBe(true);
    expect(element.querySelector('tbody')?.textContent).not.toContain('Old rows');
    await harness.fixture.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    current.flush(products('Current rows'));
    await harness.fixture.whenStable();
    expect(element.querySelector('tbody')?.textContent).toContain('Current rows');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('uses PrimeNG sorting without duplicate requests from controlled input updates', async () => {
    const { harness, element, page } = await mount('?page=2&pageSize=10');
    http.expectOne('/graphql').flush(products('Initial', 30, 10, 10));
    await harness.fixture.whenStable();
    const name = element.querySelector<HTMLTableCellElement>('th[psortablecolumn="name"]');
    if (!name) throw new Error('Missing Name header.');
    name.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await harness.fixture.whenStable();
    const ascending = http.expectOne('/graphql');
    expect(ascending.request.body).toMatchObject({
      variables: { offset: 0, sort: { field: 'NAME', direction: 'ASC' } },
    });
    ascending.flush(products('Ascending', 30, 0, 10));
    await harness.fixture.whenStable();
    expect(name.getAttribute('aria-sort')).toBe('ascending');
    name.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await harness.fixture.whenStable();
    const descending = http.expectOne('/graphql');
    expect(descending.request.body).toMatchObject({
      variables: { sort: { field: 'NAME', direction: 'DESC' } },
    });
    descending.flush(products('Descending', 30, 0, 10));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
    await harness.navigateByUrl(path + '?pageSize=10&sort=sku&order=asc');
    const changed = http.expectOne('/graphql');
    expect(changed.request.body).toMatchObject({
      variables: { sort: { field: 'SKU', direction: 'ASC' } },
    });
    changed.flush(products('SKU sorted', 30, 0, 10));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
    page.resetSort();
    await harness.fixture.whenStable();
    http.expectOne('/graphql').flush(products('Default', 30, 0, 10));
    await harness.fixture.whenStable();
    expect(name.getAttribute('aria-sort')).toBe('none');
    http.expectNone('/graphql');
  });

  it('discards a pending Table sort when navigation replaces the list query', async () => {
    const { harness, page } = await mount('?status=ACTIVE');
    http.expectOne('/graphql').flush(products('Active'));
    await harness.fixture.whenStable();
    page.sortChanged({ field: 'name', order: 1 });
    await harness.navigateByUrl(path + '?status=DRAFT');
    http.expectOne('/graphql').flush(products('Draft'));
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?status=DRAFT');
    http.expectNone('/graphql');
  });
});
