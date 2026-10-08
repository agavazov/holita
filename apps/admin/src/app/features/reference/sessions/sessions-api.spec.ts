import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApolloClient } from '@apollo/client/core';
import { SessionProgram } from './session-program/session-program';
import { SessionsApi } from './sessions-api';
import { sessionRecord, sessionsResponse } from './session-fixtures.spec-helper';
const storeA = '10000000-0000-4000-8000-000000000001',
  storeB = '10000000-0000-4000-8000-000000000002';
const eventA = sessionRecord().eventId,
  eventB = '60000000-0000-4000-8000-000000000101';
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
describe('Session program captured Apollo lifecycle', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.overrideComponent(SessionProgram, { add: { providers: [SessionsApi] } });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  async function mount(store = storeA, event = eventA) {
    const fixture = TestBed.createComponent(SessionProgram);
    fixture.componentRef.setInput('language', 'en');
    fixture.debugElement.injector.get(SessionsApi).initialize(store, 'en', event);
    await fixture.whenStable();
    return fixture;
  }
  it('cancels obsolete reads and separates identical Session queries and entities for A → B → A', async () => {
    const a = await mount(),
      old = http.expectOne('/graphql');
    a.destroy();
    expect(old.cancelled).toBe(true);
    const b = await mount(storeB, eventB);
    const readB = http.expectOne('/graphql');
    expect(readB.request.headers.get('x-store-id')).toBe(storeB);
    readB.flush(sessionsResponse([{ ...sessionRecord('B'), storeId: storeB, eventId: eventB }]));
    await b.whenStable();
    const nextA = await mount();
    http.expectOne('/graphql').flush(sessionsResponse());
    await nextA.whenStable();
    expect(b.componentInstance.rows()[0]?.title).toBe('B');
    expect(nextA.componentInstance.rows()[0]?.title).toBe('Keynote');
    b.destroy();
    nextA.destroy();
  });
  it('keeps failed complete-set order drafts, reloads membership on Cancel and prevents child editing', async () => {
    const a = await mount(),
      second = sessionRecord('Workshop', '70000000-0000-4000-8000-000000000002');
    http.expectOne('/graphql').flush(sessionsResponse([sessionRecord(), second]));
    await a.whenStable();
    a.componentInstance.moveBy(second.id, -1);
    await a.whenStable();
    expect(a.componentInstance.dirty()).toBe(true);
    const native: unknown = a.nativeElement;
    if (!(native instanceof HTMLElement)) throw new Error('Missing program');
    expect(native.querySelector('a')).toBeNull();
    const saving = a.componentInstance.saveOrder();
    const write = http.expectOne((request) => operation(request, 'AdminReorderSessions'));
    expect(write.request.body).toMatchObject({
      variables: { eventId: eventA, ids: [second.id, sessionRecord().id] },
    });
    write.flush({
      errors: [{ message: 'Session list changed', extensions: { requestId: 'conflict-id' } }],
    });
    await saving;
    await a.whenStable();
    expect(a.componentInstance.dirty()).toBe(true);
    expect(a.componentInstance.failure()).toContain('conflict-id');
    const cancel = a.componentInstance.cancelOrder();
    http
      .expectOne('/graphql')
      .flush(
        sessionsResponse([
          sessionRecord(),
          second,
          sessionRecord('New', '70000000-0000-4000-8000-000000000003'),
        ]),
      );
    await cancel;
    expect(a.componentInstance.dirty()).toBe(false);
    expect(a.componentInstance.rows()).toHaveLength(3);
    a.destroy();
  });
  it('clones submitted IDs, suppresses duplicate saves and lets a retired order write settle only in its captured client', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop'),
      a = await mount(),
      second = sessionRecord('Workshop', '70000000-0000-4000-8000-000000000002');
    http.expectOne('/graphql').flush(sessionsResponse([sessionRecord(), second]));
    await a.whenStable();
    a.componentInstance.moveBy(second.id, -1);
    const changed = vi.fn();
    a.debugElement.injector.get(SessionsApi).savedChanges.subscribe(changed);
    const saving = a.componentInstance.saveOrder();
    await a.componentInstance.saveOrder();
    const write = http.expectOne('/graphql');
    a.destroy();
    expect(write.cancelled).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    const b = await mount(storeB, eventB);
    http.expectOne('/graphql').flush(sessionsResponse());
    await b.whenStable();
    write.flush({ data: { reorderReferenceSessions: [second, sessionRecord()] } });
    await saving;
    expect(changed).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(b.componentInstance.notice()).toBe('');
    http.expectNone('/graphql');
    b.destroy();
  });
  it('keeps a submitted create alive and its copied Speaker IDs after retirement, including rejection', async () => {
    const a = await mount();
    http.expectOne('/graphql').flush(sessionsResponse());
    await a.whenStable();
    const api = a.debugElement.injector.get(SessionsApi);
    const speakerIds = [sessionRecord().id],
      input = {
        title: 'New',
        startsAt: sessionRecord().startsAt,
        endsAt: sessionRecord().endsAt,
        speakerIds,
      };
    const saving = api.create(input);
    speakerIds.splice(0);
    const rejection = expect(saving).rejects.toThrow('Inactive speaker');
    const write = http.expectOne('/graphql');
    expect(write.request.body).toMatchObject({
      variables: { eventId: eventA, input: { speakerIds: [sessionRecord().id] } },
    });
    a.destroy();
    expect(write.cancelled).toBe(false);
    write.flush({ errors: [{ message: 'Inactive speaker' }] });
    await rejection;
    await expect(api.reorder([])).rejects.toThrow('active Sessions workspace');
  });
  it('retains rows on read failure and cancels a retry during retirement', async () => {
    const a = await mount();
    http.expectOne('/graphql').flush(sessionsResponse());
    await a.whenStable();
    a.componentInstance.retry();
    http.expectOne('/graphql').flush({ errors: [{ message: 'Unavailable' }] });
    await a.whenStable();
    expect(a.componentInstance.rows()).toHaveLength(1);
    a.componentInstance.retry();
    const read = http.expectOne('/graphql');
    a.destroy();
    expect(read.cancelled).toBe(true);
  });
  it('keeps a changed-membership order draft when moving back to a matching server prefix', async () => {
    const a = await mount(),
      first = sessionRecord(),
      second = sessionRecord('Workshop', '70000000-0000-4000-8000-000000000002');
    http.expectOne('/graphql').flush(sessionsResponse([first, second]));
    await a.whenStable();
    a.componentInstance.moveBy(second.id, -1);
    a.componentInstance.retry();
    http
      .expectOne('/graphql')
      .flush(
        sessionsResponse([
          first,
          second,
          sessionRecord('New', '70000000-0000-4000-8000-000000000003'),
        ]),
      );
    await a.whenStable();
    a.componentInstance.moveBy(first.id, -1);
    expect(a.componentInstance.dirty()).toBe(true);
    expect(a.componentInstance.rows()).toHaveLength(2);
    const cancel = a.componentInstance.cancelOrder();
    http
      .expectOne('/graphql')
      .flush(
        sessionsResponse([
          first,
          second,
          sessionRecord('New', '70000000-0000-4000-8000-000000000003'),
        ]),
      );
    await cancel;
    expect(a.componentInstance.rows()).toHaveLength(3);
    a.destroy();
  });
});
