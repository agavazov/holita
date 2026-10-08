import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { routes } from '../../../app.routes';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import { EventEditor } from './event-editor';
import { ReferenceWorkspace } from '../reference-workspace';
import { eventDraft } from './event-form';
import { eventRecord, eventDetail, storeA, storeB } from './event-fixtures.spec-helper';
const path = `/en/stores/${storeA}/reference/events`;
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function editor(harness: RouterTestingHarness): EventEditor {
  const value: unknown = harness.routeDebugElement?.query(
    By.directive(EventEditor),
  ).componentInstance;
  if (!(value instanceof EventEditor)) throw new Error('Missing Event editor.');
  return value;
}
describe('Event editor forms and retirement', () => {
  let http: HttpTestingController;
  const rangeRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
  beforeEach(async () => {
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    // jsdom does not implement the Range geometry used by Tiptap's focus scrolling.
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [new DOMRect(0, 0, 1, 1)],
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Manual,
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
    if (rangeRects) Object.defineProperty(Range.prototype, 'getClientRects', rangeRects);
    else Reflect.deleteProperty(Range.prototype, 'getClientRects');
    for (const read of http.match((request) => operation(request, 'AdminMedia'))) {
      if (!read.cancelled) read.flush({ data: { referenceEventMedia: [] } });
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    http.verify({ ignoreCancelled: true });
  });
  it('hydrates a deferred description from the current disabled form without losing its draft', async () => {
    const fixture = TestBed.createComponent(EventEditor);
    fixture.componentRef.setInput('store', { id: storeA, name: 'Sofia' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    const current = fixture.componentInstance;
    current.form.controls.descriptionHtml.setValue('<p>Draft before the editor loads</p>');
    current.form.markAsDirty();
    current.form.disable();
    const block = (await fixture.getDeferBlocks())[0];
    if (!block) throw new Error('Missing description defer block.');
    await block.render(DeferBlockState.Complete);
    await fixture.whenStable();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) throw new Error('Missing Event editor element.');
    expect(root.querySelector('[contenteditable="false"]')?.textContent).toBe(
      'Draft before the editor loads',
    );
    expect(current.form.controls.descriptionHtml.value).toBe(
      '<p>Draft before the editor loads</p>',
    );
    expect(current.form.dirty).toBe(true);
    current.form.enable();
    await fixture.whenStable();
    expect(root.querySelector('[contenteditable="true"]')).not.toBeNull();
    fixture.destroy();
  });
  it('focuses a rejected description after its deferred editor becomes available', async () => {
    const fixture = TestBed.createComponent(EventEditor);
    fixture.componentRef.setInput('store', { id: storeA, name: 'Sofia' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    const current = fixture.componentInstance;
    current.form.reset(eventDraft(eventRecord()));
    const saving = current.save();
    http
      .expectOne((request) => operation(request, 'AdminCreateEvent'))
      .flush({
        errors: [
          {
            message: 'Invalid description',
            extensions: {
              fieldErrors: [{ path: 'descriptionHtml', message: 'Rejected description' }],
            },
          },
        ],
      });
    await saving;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        resolve();
      }),
    );
    const block = (await fixture.getDeferBlocks())[0];
    if (!block) throw new Error('Missing description defer block.');
    await block.render(DeferBlockState.Complete);
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('event-descriptionHtml');
    });
    expect(current.fieldError('descriptionHtml')).toBe('Rejected description');
    fixture.destroy();
  });
  async function mount(suffix = '/new') {
    const harness = await RouterTestingHarness.create(path + suffix);
    http
      .expectOne((request) => operation(request, 'AdminStores'))
      .flush({
        data: {
          stores: [
            { id: storeA, name: 'Sofia' },
            { id: storeB, name: 'Plovdiv' },
          ],
        },
      });
    await harness.fixture.whenStable();
    return harness;
  }
  it('opens the first invalid section, focuses its field and submits no request', async () => {
    const harness = await mount();
    const current = editor(harness);
    current.sections.set([]);
    await current.save();
    await harness.fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('event-title');
    });
    expect(current.sections()).toContain('general');
    http.expectNone('/graphql');
    current.form.reset(eventDraft(eventRecord()));
    current.form.controls.budget.setValue('1e2');
    await current.save();
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('event-budget');
    });
    http.expectNone('/graphql');
  });
  it('hydrates once, keeps code read-only, preserves the exact instant and omits immutable code', async () => {
    const harness = await mount('/' + eventRecord().id + '/edit?search=kept#anchor');
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    expect(current.form.controls.startsAt.value).toBe('2026-10-25T03:30');
    const code = harness.routeNativeElement?.querySelector('#event-code');
    expect(code instanceof HTMLInputElement && code.readOnly).toBe(true);
    current.form.controls.title.setValue('Changed');
    current.form.markAsDirty();
    const saving = current.save();
    await current.save();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateEvent'));
    expect(write.request.body).toMatchObject({
      variables: { input: { startsAt: eventRecord().startsAt, budget: '9999999999.99' } },
    });
    const body: unknown = write.request.body;
    expect(body).not.toHaveProperty('variables.input.code');
    expect(current.form.disabled).toBe(true);
    write.flush({
      data: {
        updateReferenceEvent: { ...eventRecord(), title: 'Changed', __typename: 'ReferenceEvent' },
      },
    });
    await saving;
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(path + '/' + eventRecord().id + '?search=kept#anchor');
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminSessions'))
      .flush({ data: { referenceSessions: [] } });
    await harness.fixture.whenStable();
  });
  it('create returns to its new editor and clearing produces explicit nullable inputs', async () => {
    const harness = await mount('/new?search=kept');
    const current = editor(harness);
    current.form.reset({
      ...eventDraft(eventRecord()),
      title: ' Created ',
      capacity: '',
      budget: '',
      summary: ' ',
      descriptionHtml: '',
      featured: false,
    });
    const saving = current.save();
    const write = http.expectOne((request) => operation(request, 'AdminCreateEvent'));
    expect(write.request.body).toMatchObject({
      variables: {
        input: {
          title: 'Created',
          capacity: null,
          budget: null,
          summary: null,
          descriptionHtml: null,
          featured: false,
          tagIds: [],
          venueId: null,
        },
      },
    });
    write.flush({
      data: {
        createReferenceEvent: { ...eventRecord(), title: 'Created', __typename: 'ReferenceEvent' },
      },
    });
    await saving;
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(path + '/' + eventRecord().id + '/edit?search=kept');
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
  });
  it('retains values and dirty state on server errors, expands the owning section and focuses the field', async () => {
    const harness = await mount('/' + eventRecord().id + '/edit');
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.form.controls.summary.setValue('Keep this');
    current.form.markAsDirty();
    current.sections.set(['general']);
    const saving = current.save();
    http
      .expectOne((request) => operation(request, 'AdminUpdateEvent'))
      .flush({
        errors: [
          {
            message: 'Invalid input',
            extensions: {
              requestId: 'event-field',
              fieldErrors: [
                { path: 'meetingUrl', message: 'Meeting is invalid' },
                { path: 'outside', message: 'Ignore' },
              ],
            },
          },
        ],
      });
    await saving;
    await harness.fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('event-meetingUrl');
    });
    expect(current.sections()).toContain('schedule');
    expect(current.form.dirty).toBe(true);
    expect(current.form.controls.summary.value).toBe('Keep this');
    expect(current.form.enabled).toBe(true);
    expect(current.fieldError('meetingUrl')).toBe('Meeting is invalid');
  });
  it('lets a submitted write settle after A → B → A and suppresses obsolete navigation and errors', async () => {
    const harness = await mount('/' + eventRecord().id + '/edit');
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
    const old = editor(harness);
    old.form.controls.title.setValue('Old A submission');
    const saving = old.save();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateEvent'));
    await harness.navigateByUrl(path.replace(storeA, storeB) + '/' + eventRecord().id + '/edit');
    http
      .expectOne((request) => operation(request, 'AdminEvent'))
      .flush(eventDetail(eventRecord(storeB, 'B')));
    await harness.fixture.whenStable();
    await harness.navigateByUrl(path + '/' + eventRecord().id + '/edit');
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
    const fresh = editor(harness);
    fresh.form.controls.title.setValue('New A draft');
    fresh.form.markAsDirty();
    expect(write.cancelled).toBe(false);
    write.flush({
      data: {
        updateReferenceEvent: {
          ...eventRecord(),
          title: 'Old A submission',
          __typename: 'ReferenceEvent',
        },
      },
    });
    await saving;
    await harness.fixture.whenStable();
    expect(editor(harness)).toBe(fresh);
    expect(fresh.form.controls.title.value).toBe('New A draft');
    expect(fresh.error()).toBeNull();
    expect(fresh.form.dirty).toBe(true);
    for (const read of http.match((request) => operation(request, 'AdminMedia'))) {
      if (!read.cancelled) read.flush({ data: { referenceEventMedia: [] } });
    }
    http.expectNone('/graphql');
  });
  it('rejects invalid detail IDs without a request and guards unsent dirty drafts', async () => {
    const harness = await mount('/invalid/edit');
    http.expectNone('/graphql');
    expect(editor(harness).invalidId()).toBe(true);
    await harness.navigateByUrl(path + '/new');
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.form.markAsDirty();
    const event = new Event('beforeunload', { cancelable: true });
    current.beforeUnload(event);
    expect(event.defaultPrevented).toBe(true);
    const leaving = current.canLeave();
    await vi.waitFor(() => {
      expect(document.querySelector('.p-confirmdialog-reject-button')).not.toBeNull();
    });
    const reject = document.querySelector('.p-confirmdialog-reject-button');
    if (!(reject instanceof HTMLButtonElement)) throw new Error('Missing reject button.');
    reject.click();
    expect(await leaving).toBe(false);
    expect(current.form.dirty).toBe(true);
  });
  it('retains write failures through background reads and offers read recovery without losing the draft', async () => {
    const harness = await mount('/' + eventRecord().id + '/edit');
    http.expectOne((request) => operation(request, 'AdminEvent')).flush(eventDetail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.retry();
    const background = http.expectOne((request) => operation(request, 'AdminEvent'));
    current.form.controls.title.setValue('Unsubmitted draft');
    current.form.markAsDirty();
    const saving = current.save();
    http
      .expectOne((request) => operation(request, 'AdminUpdateEvent'))
      .flush({
        errors: [
          {
            message: 'Write rejected',
            extensions: {
              requestId: 'write-rejected',
              fieldErrors: [{ path: 'title', message: 'Rejected field' }],
            },
          },
        ],
      });
    await saving;
    expect(current.failure()).toContain('write-rejected');
    background.flush(eventDetail(eventRecord(storeA, 'Server update')));
    await harness.fixture.whenStable();
    expect(current.failure()).toContain('write-rejected');
    expect(current.form.controls.title.value).toBe('Unsubmitted draft');
    expect(current.form.dirty).toBe(true);
    expect(
      Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).some(
        (button) => button.textContent.trim() === current.text().retry,
      ),
    ).toBe(false);
    current.form.controls.title.setValue('Corrected draft');
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
    current.retry();
    http
      .expectOne((request) => operation(request, 'AdminEvent'))
      .flush({
        errors: [{ message: 'Read unavailable', extensions: { requestId: 'read-unavailable' } }],
      });
    await harness.fixture.whenStable();
    current.form.controls.title.setValue('Continued draft');
    await harness.fixture.whenStable();
    expect(current.failure()).toContain('read-unavailable');
    const retry = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent.trim() === current.text().retry,
    );
    if (!retry) throw new Error('Missing read recovery button.');
    retry.click();
    http
      .expectOne((request) => operation(request, 'AdminEvent'))
      .flush(eventDetail(eventRecord(storeA, 'Server update')));
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
    expect(current.form.controls.title.value).toBe('Continued draft');
    expect(current.form.dirty).toBe(true);
  });
});
