import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { codecs, type ListDefinition, type ListState } from './list-state';
import { UrlListState } from './url-list-state';

type Sort = 'NAME' | 'CREATED_AT';
interface Filter {
  statuses?: readonly ('A' | 'B')[];
  view?: 'open' | 'all';
}

const definition: ListDefinition<Filter, Sort> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [
    { param: 'name', field: 'NAME' },
    { param: 'createdAt', field: 'CREATED_AT' },
  ],
  defaultSort: { field: 'CREATED_AT', direction: 'DESC' },
  viewDefaultSorts: { param: 'view', sorts: {} },
  filters: { statuses: codecs.enumList(['A', 'B']), view: codecs.choice(['open', 'all'], 'open') },
};

@Component({ selector: 'holita-list-host', template: '' })
class ListHost {
  readonly list = new UrlListState(definition);
  readonly seen: ListState<Filter, Sort>[] = [];
  constructor() {
    this.list.changes.subscribe((state) => this.seen.push(state));
  }
}

async function mount(url: string) {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'list', component: ListHost }])],
  });
  const harness = await RouterTestingHarness.create(url);
  const host: unknown = harness.routeDebugElement?.componentInstance;
  if (!(host instanceof ListHost)) {
    throw new Error('Missing host.');
  }
  return { harness, host, router: TestBed.inject(Router) };
}

async function settle(harness: RouterTestingHarness, ms = 0): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await harness.fixture.whenStable();
}

describe('UrlListState', () => {
  it('rewrites invalid and non-normalised URLs in place', async () => {
    const { harness, router } = await mount('/list?page=0&statuses=A,X&sort=nope&view=open&keep=1');
    await settle(harness);
    expect(router.url).toBe('/list?statuses=A&keep=1');
  });

  it('debounces search, rejects more than five words and resets the page', async () => {
    const { harness, host, router } = await mount('/list?page=3');
    host.list.editSearch('alpha');
    await settle(harness, 150);
    expect(router.url).toBe('/list?page=3');
    await settle(harness, 250);
    expect(router.url).toBe('/list?search=alpha');
    host.list.editSearch('one two three four five six');
    expect(host.list.searchError()).toBe('searchTooManyWords');
    await settle(harness, 350);
    expect(router.url).toBe('/list?search=alpha');
    host.list.editSearch('beta');
    host.list.cancelPending();
    await settle(harness, 350);
    expect(router.url).toBe('/list?search=alpha');
  });

  it('patches filters, sorts from table events and pages', async () => {
    const { harness, host, router } = await mount('/list?page=2');
    host.list.patchFilter({ statuses: ['B'] });
    await settle(harness);
    expect(router.url).toBe('/list?statuses=B');
    host.list.sortFromTable({ field: 'name', order: 1 });
    host.list.sortFromTable({ field: 'name', order: -1 });
    host.list.sortFromTable({ field: 'unknown', order: 1 });
    await settle(harness, 10);
    expect(router.url).toBe('/list?statuses=B&sort=name&order=desc');
    host.list.setPage({ page: 4, pageSize: 20 });
    await settle(harness);
    expect(host.list.state().page).toBe(4);
    host.list.setPage({ page: 4, pageSize: 50 });
    await settle(harness);
    expect(host.list.state()).toMatchObject({ page: 1, pageSize: 50 });
    host.list.resetSort();
    await settle(harness);
    expect(host.list.state().sort).toEqual({ field: 'CREATED_AT', direction: 'DESC' });
  });

  it('corrects past-the-end pages and clears filters but keeps the view', async () => {
    const { harness, host, router } = await mount('/list?page=9&view=all&statuses=A&search=x');
    host.list.correctPage(3);
    await settle(harness);
    expect(router.url).toBe('/list?page=3&view=all&statuses=A&search=x');
    host.list.clearFilters();
    await settle(harness);
    expect(router.url).toBe('/list?view=all');
    expect(host.list.searchDraft()).toBe('');
    expect(host.seen.map((state) => state.page)).toEqual([9, 3, 1]);
  });
});
