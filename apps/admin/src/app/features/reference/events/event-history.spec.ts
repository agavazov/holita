import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EventsApi } from './events-api';
import { EventHistory } from './event-history/event-history';
import { storeA } from './event-fixtures.spec-helper';
const eventId = '60000000-0000-4000-8000-000000000001';
function historyPage(title: string, offset = 0) {
  return {
    data: {
      referenceEventHistory: {
        __typename: 'ReferenceEventHistoryPage',
        total: 22,
        offset,
        limit: 20,
        items: [
          {
            __typename: 'ReferenceEventHistoryEntry',
            id: '70000000-0000-4000-8000-000000000001',
            eventId,
            operation: 'UPDATED',
            subject: title,
            actor: 'Anonymous',
            createdAt: '2026-10-25T01:30:00Z',
            changes: [],
          },
        ],
      },
    },
  };
}
describe('Event History reads', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EventsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(EventsApi).initialize(storeA, 'en');
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });
  async function mount() {
    const fixture = TestBed.createComponent(EventHistory);
    fixture.componentRef.setInput('eventId', eventId);
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    return fixture;
  }
  it('retires an obsolete page read and resets the page on new mutation revision', async () => {
    const fixture = await mount();
    const first = http.expectOne('/graphql');
    fixture.componentInstance.changePage({ page: 1 });
    expect(first.cancelled).toBe(true);
    const second = http.expectOne('/graphql');
    expect(second.request.body).toMatchObject({ variables: { eventId, offset: 20, limit: 20 } });
    second.flush(historyPage('Second page', 20));
    await fixture.whenStable();
    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();
    expect(fixture.componentInstance.page()).toBeNull();
    expect(fixture.componentInstance.pageNumber()).toBe(1);
    const refreshed = http.expectOne('/graphql');
    refreshed.flush(historyPage('Fresh history'));
    await fixture.whenStable();
    expect(fixture.componentInstance.page()?.items[0]?.subject).toBe('Fresh history');
    fixture.destroy();
  });
  it('retains same-page rows on refresh failure, retries with a new request ID and cancels on destruction', async () => {
    const fixture = await mount();
    http.expectOne('/graphql').flush(historyPage('Retained'));
    await fixture.whenStable();
    fixture.componentInstance.refresh();
    const failed = http.expectOne('/graphql');
    failed.flush({
      errors: [{ message: 'History unavailable', extensions: { requestId: 'history-failed' } }],
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.failure()).toContain('history-failed');
    expect(fixture.componentInstance.page()?.items[0]?.subject).toBe('Retained');
    fixture.componentInstance.refresh();
    const retry = http.expectOne('/graphql');
    expect(retry.request.headers.get('x-request-id')).not.toBe(
      failed.request.headers.get('x-request-id'),
    );
    fixture.destroy();
    expect(retry.cancelled).toBe(true);
  });
});
