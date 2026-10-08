import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApolloClient } from '@apollo/client/core';
import { SpeakersPage } from './speakers-page';
import type { AdminSpeakerFragment } from '../../../../generated/graphql/operations';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const speakerA: AdminSpeakerFragment = {
  id: '20000000-0000-4000-8000-000000000001',
  storeId: storeA,
  name: 'Sofia notebook',
  email: null,
  shortBio: null,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const speakerB: AdminSpeakerFragment = {
  id: '20000000-0000-4000-8000-000000000002',
  storeId: storeB,
  name: 'Plovdiv notebook',
  email: 'b@example.com',
  shortBio: null,
  active: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

function speakerPage(speaker: AdminSpeakerFragment) {
  return {
    data: {
      referenceSpeakers: {
        __typename: 'ReferenceSpeakerPage',
        items: [{ ...speaker, __typename: 'ReferenceSpeaker' }],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}

function pageElement(fixture: ComponentFixture<SpeakersPage>): HTMLElement {
  const element: unknown = fixture.nativeElement;
  if (!(element instanceof HTMLElement)) throw new Error('Missing Speakers page element.');
  return element;
}

describe('Speakers Apollo scope', () => {
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
    const fixture = TestBed.createComponent(SpeakersPage);
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
    const readA = http.expectOne((request) => operation(request, 'AdminSpeakers', storeA));
    const readB = http.expectOne((request) => operation(request, 'AdminSpeakers', storeB));
    expect(readA.request.headers.get('x-request-id')).not.toBe(
      readB.request.headers.get('x-request-id'),
    );
    expect(readB.request.headers.get('Accept-Language')).toBe('en');
    readB.flush(speakerPage(speakerB));
    readA.flush(speakerPage(speakerA));
    await a.whenStable();
    await b.whenStable();
    expect(a.componentInstance.page()?.items[0]?.storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.storeId).toBe(storeB);
    a.destroy();
    b.destroy();
  });

  it('keeps a submitted mutation alive after A is destroyed and never invalidates B or a new A', async () => {
    const a = await mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminSpeakers', storeA))
      .flush(speakerPage(speakerA));
    await a.whenStable();
    const oldApi = a.componentInstance.api;
    const mutation = oldApi.update({ id: speakerA.id, input: { name: 'Saved in old A' } });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateSpeaker', storeA));
    a.destroy();
    const b = await mount(storeB);
    http
      .expectOne((request) => operation(request, 'AdminSpeakers', storeB))
      .flush(speakerPage(speakerB));
    await b.whenStable();
    const newA = await mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminSpeakers', storeA))
      .flush(speakerPage(speakerA));
    await newA.whenStable();
    expect(write.cancelled).toBe(false);
    write.flush({
      data: {
        updateReferenceSpeaker: {
          ...speakerA,
          __typename: 'ReferenceSpeaker',
          name: 'Saved in old A',
        },
      },
    });
    expect((await mutation).storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.name).toBe(speakerB.name);
    expect(newA.componentInstance.page()?.items[0]?.name).toBe(speakerA.name);
    http.expectNone('/graphql');
    await expect(
      oldApi.update({ id: speakerA.id, input: { name: 'Obsolete write' } }),
    ).rejects.toThrow('active Speakers workspace');
    b.destroy();
    newA.destroy();
  });

  it('releases a retired client after a failed mutation without changing the new store', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = await mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminSpeakers', storeA))
      .flush(speakerPage(speakerA));
    await a.whenStable();
    const mutation = a.componentInstance.api.update({
      id: speakerA.id,
      input: { email: 'invalid' },
    });
    const rejection = expect(mutation).rejects.toThrow('Invalid email');
    const write = http.expectOne((request) => operation(request, 'AdminUpdateSpeaker', storeA));
    a.destroy();
    expect(stop).not.toHaveBeenCalled();
    const b = await mount(storeB);
    http
      .expectOne((request) => operation(request, 'AdminSpeakers', storeB))
      .flush(speakerPage(speakerB));
    await b.whenStable();
    write.flush({
      errors: [
        {
          message: 'Invalid email',
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
    http
      .expectOne((request) => operation(request, 'AdminSpeakers', storeA))
      .flush(speakerPage(speakerA));
    await a.whenStable();
    a.componentInstance.refresh();
    const failed = http.expectOne('/graphql');
    failed.flush({
      errors: [
        {
          message: 'Speakers unavailable',
          extensions: { code: 'SERVICE_UNAVAILABLE', requestId: 'refresh-id' },
        },
      ],
    });
    await a.whenStable();
    expect(a.componentInstance.page()?.items[0]?.name).toBe(speakerA.name);
    expect(a.componentInstance.failure()).toContain('Speakers unavailable (refresh-id)');
    expect(pageElement(a).querySelector('[role="alert"]')?.textContent).toContain('refresh-id');
    expect(pageElement(a).querySelector('tbody')?.textContent).toContain(speakerA.name);
    a.componentInstance.refresh();
    const retry = http.expectOne('/graphql');
    expect(retry.request.headers.get('x-request-id')).not.toBe(
      failed.request.headers.get('x-request-id'),
    );
    retry.flush(speakerPage(speakerA));
    await a.whenStable();
    expect(a.componentInstance.error()).toBeNull();
    a.destroy();
  });

  it('stops a retired client only after both submitted writes settle', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = await mount(storeA);
    http.expectOne('/graphql').flush(speakerPage(speakerA));
    await a.whenStable();
    const api = a.componentInstance.api;
    const first = api.update({ id: speakerA.id, input: { name: 'First write' } });
    const firstWrite = http.expectOne('/graphql');
    const second = api.update({ id: speakerA.id, input: { name: 'Second write' } });
    const rejection = expect(second).rejects.toThrow('Second failed');
    const secondWrite = http.expectOne('/graphql');
    a.destroy();
    expect(stop).not.toHaveBeenCalled();
    expect(firstWrite.cancelled).toBe(false);
    expect(secondWrite.cancelled).toBe(false);
    firstWrite.flush({
      data: { updateReferenceSpeaker: { ...speakerA, __typename: 'ReferenceSpeaker' } },
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
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading speakers');
    const read = http.expectOne('/graphql');
    const requestId = read.request.headers.get('x-request-id');
    read.error(new ProgressEvent('error'));
    await a.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(requestId);
    expect(element.querySelector('tbody')?.textContent).not.toContain('No speakers in this store.');
    const retry = element.querySelector<HTMLButtonElement>('button');
    expect(retry?.textContent).toContain('Retry');
    retry?.click();
    const next = http.expectOne('/graphql');
    expect(next.request.headers.get('x-request-id')).not.toBe(requestId);
    next.flush({
      data: {
        referenceSpeakers: {
          __typename: 'ReferenceSpeakerPage',
          items: [],
          total: 0,
          offset: 0,
          limit: 20,
        },
      },
    });
    await a.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('tbody')?.textContent).toContain('No speakers in this store.');
    expect(element.querySelector('th[psortablecolumn="name"]')?.textContent.trim()).toBe('Name');
    a.destroy();
  });
});
