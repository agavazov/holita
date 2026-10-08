import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../../app.routes';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import { TagsPage } from './tags-page';

const store = '10000000-0000-4000-8000-000000000001';
const path = `/en/stores/${store}/reference/tags`;

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function tags(name: string, total = 50, offset = 0, limit = 20) {
  return {
    data: {
      referenceTags: {
        __typename: 'ReferenceTagPage',
        total,
        offset,
        limit,
        items: [
          {
            __typename: 'ReferenceTag',
            id: crypto.randomUUID(),
            storeId: store,
            name,
            color: '#315ed0',
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  };
}

describe('Tags list URL and requests', () => {
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
      By.directive(TagsPage),
    ).componentInstance;
    if (!(instance instanceof TagsPage) || !harness.routeNativeElement)
      throw new Error('Missing Tags page.');
    return { harness, page: instance, element: harness.routeNativeElement };
  }

  it('keeps a bookmarked page while total is unknown and sends generated server variables', async () => {
    const { harness, element } = await mount('?page=3');
    const read = http.expectOne((request) => operation(request, 'AdminTags'));
    expect(read.request.body).toMatchObject({
      variables: { offset: 40, limit: 20, sort: { field: 'CREATED_AT', direction: 'DESC' } },
    });
    expect(router.url).toBe(path + '?page=3');
    expect(element.querySelector('p-paginator')).toBeNull();
    read.flush(tags('Third page', 50, 40));
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
      '?page=-2&pageSize=999&active=BAD&sort=unknown&order=desc&search=%20note%20&keep=yes#anchor',
    );
    const read = http.expectOne((request) => operation(request, 'AdminTags'));
    expect(read.request.body).toMatchObject({
      variables: {
        offset: 0,
        limit: 20,
        search: 'note',
        sort: { field: 'CREATED_AT', direction: 'DESC' },
      },
    });
    read.flush(tags('note'));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?search=note&keep=yes#anchor');
    http.expectNone('/graphql');
  });

  it('bounds GraphQL Int offsets and filters by Unicode code points before issuing a request', async () => {
    const { harness } = await mount(
      '?page=999999999999&pageSize=100&search=' + encodeURIComponent('😀'.repeat(201)),
    );
    const read = http.expectOne('/graphql');
    expect(read.request.body).toMatchObject({
      variables: { offset: 2147483600, limit: 100, search: '😀'.repeat(200) },
    });
    read.flush({
      data: {
        referenceTags: {
          __typename: 'ReferenceTagPage',
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
        referenceTags: {
          __typename: 'ReferenceTagPage',
          items: [],
          total: 0,
          offset: 0,
          limit: 100,
        },
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
        referenceTags: {
          __typename: 'ReferenceTagPage',
          items: [],
          total: 50,
          offset: 60,
          limit: 20,
        },
      },
    });
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=3');
    const last = http.expectOne('/graphql');
    expect(last.request.body).toMatchObject({ variables: { offset: 40, limit: 20 } });
    last.flush(tags('Last page', 50, 40));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
  });

  it('does not correct a revisited page from an obsolete cached total', async () => {
    const { harness, element } = await mount('?page=4');
    http.expectOne('/graphql').flush({
      data: {
        referenceTags: {
          __typename: 'ReferenceTagPage',
          items: [],
          total: 50,
          offset: 60,
          limit: 20,
        },
      },
    });
    await harness.fixture.whenStable();
    http.expectOne('/graphql').flush(tags('Last page', 50, 40));
    await harness.fixture.whenStable();
    await harness.navigateByUrl(path + '?page=4');
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=4');
    expect(element.querySelector('p-paginator')).toBeNull();
    const read = http.expectOne('/graphql');
    expect(read.cancelled).toBe(false);
    read.flush(tags('Newly available page', 80, 60));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=4');
    expect(element.querySelector('tbody')?.textContent).toContain('Newly available page');
    http.expectNone('/graphql');
  });

  it('clears uncommitted drafts even when the applied URL is already unfiltered', async () => {
    const { harness, page, element } = await mount();
    http.expectOne('/graphql').flush(tags('Initial'));
    await harness.fixture.whenStable();
    page.editSearch('pending search');
    page.clearFilters();
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path);
    expect(element.querySelector<HTMLInputElement>('#tag-search')?.value).toBe('');
    http.expectNone('/graphql');
  });

  it('commits pending text with an immediate inactive change and never restores cleared filters', async () => {
    const { harness, page, element } = await mount(
      '?page=2&pageSize=10&sort=color&order=desc&keep=yes#anchor',
    );
    http.expectOne((request) => operation(request, 'AdminTags')).flush(tags('First', 30, 10, 10));
    await harness.fixture.whenStable();
    const search = element.querySelector<HTMLInputElement>('#tag-search');
    if (!search) throw new Error('Missing search input.');
    search.value = 'note';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
    page.changeActive(false);
    await harness.fixture.whenStable();
    const filtered = http.expectOne((request) => operation(request, 'AdminTags'));
    expect(filtered.request.body).toMatchObject({
      variables: {
        offset: 0,
        limit: 10,
        search: 'note',
        active: false,
        sort: { field: 'COLOR', direction: 'DESC' },
      },
    });
    filtered.flush(tags('Filtered', 20, 0, 10));
    await harness.fixture.whenStable();
    page.editSearch('pending');
    page.clearFilters();
    await harness.fixture.whenStable();
    const cleared = http.expectOne((request) => operation(request, 'AdminTags'));
    expect(cleared.request.body).toMatchObject({
      variables: { offset: 0, limit: 10, sort: { field: 'COLOR', direction: 'DESC' } },
    });
    cleared.flush(tags('Clear', 20, 0, 10));
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?pageSize=10&sort=color&order=desc&keep=yes#anchor');
    expect(page.search()).toBe('');
    http.expectNone('/graphql');
  });

  it('debounces text, resets the page and recovers an empty filtered result', async () => {
    const { harness, page, element } = await mount('?page=2');
    http.expectOne('/graphql').flush(tags('Initial', 50, 20));
    await harness.fixture.whenStable();
    page.editSearch('unmatched');
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?page=2');
    http.expectNone('/graphql');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    const read = http.expectOne('/graphql');
    expect(router.url).toBe(path + '?search=unmatched');
    read.flush({
      data: {
        referenceTags: {
          __typename: 'ReferenceTagPage',
          items: [],
          total: 0,
          offset: 0,
          limit: 20,
        },
      },
    });
    await harness.fixture.whenStable();
    expect(element.querySelector('tbody')?.textContent).toContain('No tags match these filters.');
  });

  it('restores URL drafts on navigation and cancels the uncommitted debounce', async () => {
    const { harness, page, element } = await mount('?active=true');
    http.expectOne('/graphql').flush(tags('Active'));
    await harness.fixture.whenStable();
    page.editSearch('obsolete draft');
    await harness.navigateByUrl(path + '?active=false');
    http.expectOne('/graphql').flush(tags('Draft'));
    await harness.fixture.whenStable();
    expect(page.search()).toBe('');
    expect(element.querySelector<HTMLInputElement>('#tag-search')?.value).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?active=false');
    http.expectNone('/graphql');
  });

  it('disposes an old query and ignores its aborted refresh after filters change', async () => {
    const { harness, page, element } = await mount();
    http.expectOne('/graphql').flush(tags('Old rows'));
    await harness.fixture.whenStable();
    page.refresh();
    const oldRefresh = http.expectOne('/graphql');
    await harness.navigateByUrl(path + '?active=false');
    const current = http.expectOne('/graphql');
    expect(oldRefresh.cancelled).toBe(true);
    expect(element.querySelector('tbody')?.textContent).not.toContain('Old rows');
    await harness.fixture.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    current.flush(tags('Current rows'));
    await harness.fixture.whenStable();
    expect(element.querySelector('tbody')?.textContent).toContain('Current rows');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('uses PrimeNG sorting without duplicate requests from controlled input updates', async () => {
    const { harness, element, page } = await mount('?page=2&pageSize=10');
    http.expectOne('/graphql').flush(tags('Initial', 30, 10, 10));
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
    ascending.flush(tags('Ascending', 30, 0, 10));
    await harness.fixture.whenStable();
    expect(name.getAttribute('aria-sort')).toBe('ascending');
    name.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await harness.fixture.whenStable();
    const descending = http.expectOne('/graphql');
    expect(descending.request.body).toMatchObject({
      variables: { sort: { field: 'NAME', direction: 'DESC' } },
    });
    descending.flush(tags('Descending', 30, 0, 10));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
    await harness.navigateByUrl(path + '?pageSize=10&sort=color&order=asc');
    const changed = http.expectOne('/graphql');
    expect(changed.request.body).toMatchObject({
      variables: { sort: { field: 'COLOR', direction: 'ASC' } },
    });
    changed.flush(tags('Color sorted', 30, 0, 10));
    await harness.fixture.whenStable();
    http.expectNone('/graphql');
    page.resetSort();
    await harness.fixture.whenStable();
    http.expectOne('/graphql').flush(tags('Default', 30, 0, 10));
    await harness.fixture.whenStable();
    expect(name.getAttribute('aria-sort')).toBe('none');
    http.expectNone('/graphql');
  });

  it('discards a pending Table sort when navigation replaces the list query', async () => {
    const { harness, page } = await mount('?active=true');
    http.expectOne('/graphql').flush(tags('Active'));
    await harness.fixture.whenStable();
    page.sortChanged({ field: 'name', order: 1 });
    await harness.navigateByUrl(path + '?active=false');
    http.expectOne('/graphql').flush(tags('Draft'));
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?active=false');
    http.expectNone('/graphql');
  });
});
