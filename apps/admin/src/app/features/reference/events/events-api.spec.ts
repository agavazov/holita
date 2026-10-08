import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApolloClient } from '@apollo/client/core';
import { EventsPage } from './events-page';
import { EventsApi } from './events-api';
import { eventRecord } from './event-fixtures.spec-helper';
import type { AdminEventDetailsFragment } from '../../../../generated/graphql/operations';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const eventA = eventRecord(storeA, 'Sofia event');
const eventB = eventRecord(storeB, 'Plovdiv event');

function operation(request: HttpRequest<unknown>, title: string, storeId: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-store-id') === storeId &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === title
  );
}

function eventPage(tag: AdminEventDetailsFragment) {
  return {
    data: {
      referenceEvents: {
        __typename: 'ReferenceEventPage',
        items: [{ ...tag, __typename: 'ReferenceEvent' }],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}

function pageElement(fixture: ComponentFixture<EventsPage>): HTMLElement {
  const element: unknown = fixture.nativeElement;
  if (!(element instanceof HTMLElement)) throw new Error('Missing Events page element.');
  return element;
}

describe('Events Apollo scope', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  async function mount(storeId: string) {
    const fixture = TestBed.createComponent(EventsPage);
    fixture.componentRef.setInput('store', {
      id: storeId,
      name: storeId === storeA ? 'Sofia' : 'Plovdiv',
    });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    return fixture;
  }

  it('separates concurrent identical list queries, entity caches and request headers', async () => {
    const a = await mount(storeA);
    const b = await mount(storeB);
    const readA = http.expectOne((request) => operation(request, 'AdminEvents', storeA));
    const readB = http.expectOne((request) => operation(request, 'AdminEvents', storeB));
    expect(readA.request.headers.get('x-request-id')).not.toBe(
      readB.request.headers.get('x-request-id'),
    );
    expect(readB.request.headers.get('Accept-Language')).toBe('en');
    readB.flush(eventPage(eventB));
    readA.flush(eventPage(eventA));
    await a.whenStable();
    await b.whenStable();
    expect(a.componentInstance.page()?.items[0]?.storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.storeId).toBe(storeB);
    a.destroy();
    b.destroy();
  });

  it('keeps a submitted mutation alive after A is destroyed and never invalidates B or a new A', async () => {
    const a = await mount(storeA);
    http.expectOne((request) => operation(request, 'AdminEvents', storeA)).flush(eventPage(eventA));
    await a.whenStable();
    const oldApi = a.debugElement.injector.get(EventsApi);
    const mutation = oldApi.update({ id: eventA.id, input: { title: 'Saved in old A' } });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateEvent', storeA));
    a.destroy();
    const b = await mount(storeB);
    http.expectOne((request) => operation(request, 'AdminEvents', storeB)).flush(eventPage(eventB));
    await b.whenStable();
    const newA = await mount(storeA);
    http.expectOne((request) => operation(request, 'AdminEvents', storeA)).flush(eventPage(eventA));
    await newA.whenStable();
    expect(write.cancelled).toBe(false);
    write.flush({
      data: {
        updateReferenceEvent: { ...eventA, __typename: 'ReferenceEvent', title: 'Saved in old A' },
      },
    });
    expect((await mutation).storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.title).toBe(eventB.title);
    expect(newA.componentInstance.page()?.items[0]?.title).toBe(eventA.title);
    http.expectNone('/graphql');
    await expect(
      oldApi.update({ id: eventA.id, input: { title: 'Obsolete write' } }),
    ).rejects.toThrow('active Events workspace');
    b.destroy();
    newA.destroy();
  });

  it('releases a retired client after a failed mutation without changing the new store', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = await mount(storeA);
    http.expectOne((request) => operation(request, 'AdminEvents', storeA)).flush(eventPage(eventA));
    await a.whenStable();
    const mutation = a.debugElement.injector.get(EventsApi).update({
      id: eventA.id,
      input: { budget: 'bad' },
    });
    const rejection = expect(mutation).rejects.toThrow('Invalid budget');
    const write = http.expectOne((request) => operation(request, 'AdminUpdateEvent', storeA));
    a.destroy();
    expect(stop).not.toHaveBeenCalled();
    const b = await mount(storeB);
    http.expectOne((request) => operation(request, 'AdminEvents', storeB)).flush(eventPage(eventB));
    await b.whenStable();
    write.flush({
      errors: [
        {
          message: 'Invalid budget',
          extensions: { code: 'CONFLICT', requestId: 'failed-write' },
        },
      ],
    });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(b.componentInstance.error()).toBeNull();
    expect(b.componentInstance.page()?.items[0]?.storeId).toBe(storeB);
    http.expectNone('/graphql');
    b.destroy();
  });

  it('retains loaded rows on a GraphQL refresh error and recovers with a new request ID', async () => {
    const a = await mount(storeA);
    http.expectOne((request) => operation(request, 'AdminEvents', storeA)).flush(eventPage(eventA));
    await a.whenStable();
    a.componentInstance.refresh();
    const failed = http.expectOne('/graphql');
    failed.flush({
      errors: [
        {
          message: 'Events unavailable',
          extensions: { code: 'SERVICE_UNAVAILABLE', requestId: 'refresh-id' },
        },
      ],
    });
    await a.whenStable();
    expect(a.componentInstance.page()?.items[0]?.title).toBe(eventA.title);
    expect(a.componentInstance.failure()).toContain('Events unavailable (refresh-id)');
    expect(pageElement(a).querySelector('[role="alert"]')?.textContent).toContain('refresh-id');
    expect(pageElement(a).querySelector('tbody')?.textContent).toContain(eventA.title);
    a.componentInstance.refresh();
    const retry = http.expectOne('/graphql');
    expect(retry.request.headers.get('x-request-id')).not.toBe(
      failed.request.headers.get('x-request-id'),
    );
    retry.flush(eventPage(eventA));
    await a.whenStable();
    expect(a.componentInstance.error()).toBeNull();
    a.destroy();
  });

  it('stops a retired client only after both submitted writes settle', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = await mount(storeA);
    http.expectOne('/graphql').flush(eventPage(eventA));
    await a.whenStable();
    const api = a.debugElement.injector.get(EventsApi);
    const first = api.update({ id: eventA.id, input: { title: 'First write' } });
    const firstWrite = http.expectOne('/graphql');
    const second = api.update({ id: eventA.id, input: { title: 'Second write' } });
    const rejection = expect(second).rejects.toThrow('Second failed');
    const secondWrite = http.expectOne('/graphql');
    a.destroy();
    expect(stop).not.toHaveBeenCalled();
    expect(firstWrite.cancelled).toBe(false);
    expect(secondWrite.cancelled).toBe(false);
    firstWrite.flush({
      data: { updateReferenceEvent: { ...eventA, __typename: 'ReferenceEvent' } },
    });
    await first;
    expect(stop).not.toHaveBeenCalled();
    secondWrite.flush({ errors: [{ message: 'Second failed' }] });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('renders an initial error and retry followed by the empty Table state', async () => {
    const a = await mount(storeA);
    const element = pageElement(a);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading events');
    const read = http.expectOne('/graphql');
    const requestId = read.request.headers.get('x-request-id');
    read.error(new ProgressEvent('error'));
    await a.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(requestId);
    expect(element.querySelector('tbody')?.textContent).not.toContain(
      'No events match these filters.',
    );
    const retry = element.querySelector<HTMLButtonElement>('button');
    expect(retry?.textContent).toContain('Retry');
    retry?.click();
    const next = http.expectOne('/graphql');
    expect(next.request.headers.get('x-request-id')).not.toBe(requestId);
    next.flush({
      data: {
        referenceEvents: {
          __typename: 'ReferenceEventPage',
          items: [],
          total: 0,
          offset: 0,
          limit: 20,
        },
      },
    });
    await a.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('tbody')?.textContent).toContain('No events match these filters.');
    expect(element.querySelector('th[psortablecolumn="title"]')?.textContent.trim()).toBe('Title');
    a.destroy();
  });

  it('submits one atomic bulk request with captured IDs and lets it settle after retirement', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = await mount(storeA);
    http.expectOne('/graphql').flush(eventPage(eventA));
    await a.whenStable();
    const ids = [eventA.id, '60000000-0000-4000-8000-000000000003'];
    const submitted = [...ids];
    const action = a.debugElement.injector.get(EventsApi).applyAction({ action: 'publish', ids });
    ids.splice(0);
    const write = http.expectOne((request) => operation(request, 'AdminSetEventsStatus', storeA));
    expect(write.request.body).toMatchObject({
      variables: { ids: submitted, status: 'PUBLISHED' },
    });
    a.destroy();
    expect(write.cancelled).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    const b = await mount(storeB);
    http.expectOne('/graphql').flush(eventPage(eventB));
    await b.whenStable();
    write.flush({ data: { setReferenceEventsStatus: { ids: submitted, count: 2 } } });
    expect(await action).toMatchObject({ ids: submitted, count: 2 });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(b.componentInstance.actionComplete()).toBe(false);
    http.expectNone('/graphql');
    b.destroy();
  });
  it('keeps selected IDs on a rejected action and allows a fresh retry', async () => {
    const a = await mount(storeA);
    http.expectOne('/graphql').flush(eventPage(eventA));
    await a.whenStable();
    a.componentInstance.selectRow(eventA.id, true);
    const api = a.debugElement.injector.get(EventsApi);
    const failed = api.applyAction({ action: 'trash', ids: [...a.componentInstance.selected()] });
    const rejection = expect(failed).rejects.toThrow('Selection changed');
    http
      .expectOne((request) => operation(request, 'AdminTrashEvents', storeA))
      .flush({ errors: [{ message: 'Selection changed' }] });
    await rejection;
    expect(a.componentInstance.selected()).toEqual([eventA.id]);
    const retry = api.applyAction({ action: 'trash', ids: [...a.componentInstance.selected()] });
    http
      .expectOne((request) => operation(request, 'AdminTrashEvents', storeA))
      .flush({ data: { trashReferenceEvents: { ids: [eventA.id], count: 1 } } });
    expect(await retry).toMatchObject({ count: 1 });
    a.destroy();
  });
});
