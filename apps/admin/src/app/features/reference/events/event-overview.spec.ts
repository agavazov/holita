import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../../app.routes';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import { ReferenceWorkspace } from '../reference-workspace';
import { SessionProgram } from '../sessions/session-program/session-program';
import { sessionRecord, sessionsResponse } from '../sessions/session-fixtures.spec-helper';
import { eventDetail, eventRecord, storeA } from './event-fixtures.spec-helper';
import { EventOverview } from './event-overview';
import { EventsApi } from './events-api';

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

describe('Event overview background refresh', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    TestBed.configureTestingModule({
      imports: [ReferenceWorkspace],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
      ],
    });
    await TestBed.compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the same mounted program and unsaved order through a failed parent refresh and recovery', async () => {
    const watch = vi.spyOn(EventsApi.prototype, 'watchEvent');
    const harness = await RouterTestingHarness.create(
      `/en/stores/${storeA}/reference/events/${eventRecord().id}?tab=sessions`,
    );
    http
      .expectOne((request) => operation(request, 'AdminStores'))
      .flush({ data: { stores: [{ id: storeA, name: 'Sofia' }] } });
    await harness.fixture.whenStable();
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
    const second = sessionRecord('Workshop', '70000000-0000-4000-8000-000000000002');
    http
      .expectOne((request) => operation(request, 'AdminSessions'))
      .flush(sessionsResponse([sessionRecord(), second]));
    await harness.fixture.whenStable();
    const program: unknown = harness.routeDebugElement?.query(
      By.directive(SessionProgram),
    ).componentInstance;
    const overview: unknown = harness.routeDebugElement?.query(
      By.directive(EventOverview),
    ).componentInstance;
    if (!(program instanceof SessionProgram) || !(overview instanceof EventOverview))
      throw new Error('Missing Event program.');
    program.moveBy(second.id, -1);
    await harness.fixture.whenStable();
    expect(program.rows().map((row) => row.title)).toEqual(['Workshop', 'Keynote']);
    const read = watch.mock.results[0];
    if (read?.type !== 'return') throw new Error('Missing Event query.');
    const failed = read.value.refetch();
    const rejected = expect(failed).rejects.toThrow('Parent refresh unavailable');
    http
      .expectOne((request) => operation(request, 'AdminEvent'))
      .flush({ errors: [{ message: 'Parent refresh unavailable' }] });
    await rejected;
    await harness.fixture.whenStable();
    expect(overview.failure()).toContain('Parent refresh unavailable');
    expect(harness.routeDebugElement?.query(By.directive(SessionProgram)).componentInstance).toBe(
      program,
    );
    expect(program.dirty()).toBe(true);
    expect(program.rows().map((row) => row.title)).toEqual(['Workshop', 'Keynote']);
    const recovered = read.value.refetch();
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await recovered;
    await harness.fixture.whenStable();
    expect(overview.error()).toBeNull();
    expect(program.dirty()).toBe(true);
    expect(program.rows().map((row) => row.title)).toEqual(['Workshop', 'Keynote']);
    http.expectNone(
      (request) =>
        operation(request, 'AdminReorderSessions') || operation(request, 'AdminSessions'),
    );
    harness.fixture.destroy();
  });
});
