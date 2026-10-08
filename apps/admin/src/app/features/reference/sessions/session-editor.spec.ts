import type { Mock } from 'vitest';
import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessionEditor } from './session-editor/session-editor';
import { sessionRecord } from './session-fixtures.spec-helper';
import { eventRecord, eventDetail, storeA, storeB } from '../events/event-fixtures.spec-helper';
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
describe('Session editor typed form and retired callbacks', () => {
  let http: HttpTestingController;
  let navigation: Mock<Router['navigate']>;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SessionEditor],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    await TestBed.compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigation = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  async function mount(sessionId: string | null = null, storeId = storeA) {
    const fixture = TestBed.createComponent(SessionEditor);
    fixture.componentRef.setInput('store', { id: storeId, name: 'Sofia' });
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('eventId', eventRecord().id);
    fixture.componentRef.setInput('sessionId', sessionId);
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminEvent'))
      .flush(eventDetail(eventRecord(storeId)));
    await fixture.whenStable();
    if (sessionId !== null) {
      http
        .expectOne((request) => operation(request, 'AdminSession'))
        .flush({
          data: {
            referenceSession: {
              ...sessionRecord(),
              id: sessionId,
              storeId,
              __typename: 'ReferenceSession',
            },
          },
        });
      await fixture.whenStable();
    }
    return fixture;
  }
  it('focuses invalid bounds without a write, then submits nullable fields and the precise saved start', async () => {
    const fixture = await mount(),
      editor = fixture.componentInstance;
    editor.form.controls.title.setValue('New session');
    editor.form.controls.endsAt.setValue('2026-10-25T07:00');
    await editor.save();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('session-endsAt');
    });
    http.expectNone('/graphql');
    editor.form.controls.endsAt.setValue('2026-10-25T05:00');
    const saving = editor.save();
    await editor.save();
    const write = http.expectOne((request) => operation(request, 'AdminCreateSession'));
    expect(write.request.body).toMatchObject({
      variables: {
        eventId: eventRecord().id,
        input: {
          startsAt: eventRecord().startsAt,
          title: 'New session',
          summary: null,
          room: null,
          speakerIds: [],
        },
      },
    });
    expect(editor.form.disabled).toBe(true);
    write.flush({
      data: {
        createReferenceSession: { ...sessionRecord('New session'), __typename: 'ReferenceSession' },
      },
    });
    await saving;
    expect(navigation).toHaveBeenCalledWith(
      ['/', 'en', 'stores', storeA, 'reference', 'events', eventRecord().id],
      expect.objectContaining({
        queryParams: { tab: 'sessions' },
        queryParamsHandling: 'merge',
        preserveFragment: true,
      }),
    );
    fixture.destroy();
  });
  it('retains a rejected draft, re-enables controls and focuses the known server field', async () => {
    const fixture = await mount(sessionRecord().id),
      editor = fixture.componentInstance;
    editor.form.controls.room.setValue('Keep room');
    editor.form.markAsDirty();
    const saving = editor.save();
    http
      .expectOne((request) => operation(request, 'AdminUpdateSession'))
      .flush({
        errors: [
          {
            message: 'Invalid room',
            extensions: {
              requestId: 'room-error',
              fieldErrors: [
                { path: 'room', message: 'Room unavailable' },
                { path: 'other', message: 'Ignore' },
              ],
            },
          },
        ],
      });
    await saving;
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('session-room');
    });
    expect(editor.fieldError('room')).toBe('Room unavailable');
    expect(editor.form.dirty).toBe(true);
    expect(editor.form.enabled).toBe(true);
    expect(editor.form.controls.room.value).toBe('Keep room');
    fixture.destroy();
  });
  it('does not navigate or change a new editor after a captured write settles', async () => {
    const old = await mount(sessionRecord().id);
    old.componentInstance.form.controls.title.setValue('Old write');
    const saving = old.componentInstance.save();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateSession'));
    old.destroy();
    expect(write.cancelled).toBe(false);
    const next = await mount('70000000-0000-4000-8000-000000000002', storeB);
    next.componentInstance.form.controls.title.setValue('New draft');
    next.componentInstance.form.markAsDirty();
    write.flush({
      data: {
        updateReferenceSession: { ...sessionRecord('Old write'), __typename: 'ReferenceSession' },
      },
    });
    await saving;
    await next.whenStable();
    expect(next.componentInstance.form.controls.title.value).toBe('New draft');
    expect(navigation).not.toHaveBeenCalled();
    http.expectNone('/graphql');
    next.destroy();
  });
  it('blocks malformed IDs before starting any parent or child request', async () => {
    const fixture = TestBed.createComponent(SessionEditor);
    fixture.componentRef.setInput('store', { id: storeA, name: 'Sofia' });
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('eventId', eventRecord().id);
    fixture.componentRef.setInput('sessionId', 'invalid');
    await fixture.whenStable();
    expect(fixture.componentInstance.invalidId()).toBe(true);
    http.expectNone('/graphql');
    fixture.destroy();
  });
  it.each(['AdminEvent', 'AdminSession'])(
    'keeps a failed %s read visible when the other retry succeeds later',
    async (failedOperation) => {
      const fixture = await mount(sessionRecord().id);
      const editor = fixture.componentInstance;
      editor.retry();
      const event = http.expectOne((request) => operation(request, 'AdminEvent'));
      const session = http.expectOne((request) => operation(request, 'AdminSession'));
      const failed = failedOperation === 'AdminEvent' ? event : session;
      failed.flush({ errors: [{ message: 'Read still unavailable' }] });
      await fixture.whenStable();
      if (failedOperation === 'AdminEvent')
        session.flush({
          data: { referenceSession: { ...sessionRecord(), __typename: 'ReferenceSession' } },
        });
      else event.flush(eventDetail());
      await fixture.whenStable();
      expect(editor.failure()).toContain('Read still unavailable');
      const root: unknown = fixture.nativeElement;
      if (!(root instanceof HTMLElement)) throw new Error('Missing session editor element.');
      expect(root.textContent).toContain('Read still unavailable');
      const retry = Array.from(root.querySelectorAll('button')).find(
        (button) => button.textContent.trim() === editor.text().retry,
      );
      if (!retry) throw new Error('Missing read recovery button.');
      retry.click();
      http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
      http
        .expectOne((request) => operation(request, 'AdminSession'))
        .flush({
          data: { referenceSession: { ...sessionRecord(), __typename: 'ReferenceSession' } },
        });
      await fixture.whenStable();
      expect(editor.error()).toBeNull();
      fixture.destroy();
    },
  );
  it('keeps loading active until both parent and session retries settle', async () => {
    const fixture = await mount(sessionRecord().id);
    const editor = fixture.componentInstance;
    editor.retry();
    const event = http.expectOne((request) => operation(request, 'AdminEvent'));
    const session = http.expectOne((request) => operation(request, 'AdminSession'));
    event.flush(eventDetail());
    await fixture.whenStable();
    expect(editor.loading()).toBe(true);
    session.flush({
      data: { referenceSession: { ...sessionRecord(), __typename: 'ReferenceSession' } },
    });
    await fixture.whenStable();
    expect(editor.loading()).toBe(false);
    fixture.destroy();
  });
  it('retains rejected fields and their server error after earlier reads finish', async () => {
    const fixture = await mount(sessionRecord().id);
    const editor = fixture.componentInstance;
    editor.retry();
    const event = http.expectOne((request) => operation(request, 'AdminEvent'));
    const session = http.expectOne((request) => operation(request, 'AdminSession'));
    editor.form.controls.room.setValue('Rejected room');
    editor.form.markAsDirty();
    const saving = editor.save();
    http
      .expectOne((request) => operation(request, 'AdminUpdateSession'))
      .flush({
        errors: [
          {
            message: 'Room rejected',
            extensions: { fieldErrors: [{ path: 'room', message: 'Choose another room' }] },
          },
        ],
      });
    await saving;
    event.flush(eventDetail());
    session.flush({
      data: { referenceSession: { ...sessionRecord(), __typename: 'ReferenceSession' } },
    });
    await fixture.whenStable();
    expect(editor.form.controls.room.value).toBe('Rejected room');
    expect(editor.form.dirty).toBe(true);
    expect(editor.fieldError('room')).toBe('Choose another room');
    fixture.destroy();
  });
});
