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
import { AdminShell } from '../../../layout/admin-shell';
import { SpeakerEditor } from './speaker-editor';
import type { AdminSpeakerFragment } from '../../../../generated/graphql/operations';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const speakerA = '20000000-0000-4000-8000-000000000001';
const speakerB = '20000000-0000-4000-8000-000000000002';
const path = `/en/stores/${storeA}/reference/speakers`;
const stores = [
  { id: storeA, name: 'Sofia' },
  { id: storeB, name: 'Plovdiv' },
];
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function record(id = speakerA, storeId = storeA, name = 'Initial speaker'): AdminSpeakerFragment {
  return {
    id,
    storeId,
    name,
    email: 'initial@example.com',
    shortBio: 'Initial biography',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
function detail(speaker = record()) {
  return { data: { referenceSpeaker: { ...speaker, __typename: 'ReferenceSpeaker' } } };
}
function list(speaker = record()) {
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
function editor(harness: RouterTestingHarness): SpeakerEditor {
  const instance: unknown = harness.routeDebugElement?.query(
    By.directive(SpeakerEditor),
  ).componentInstance;
  if (!(instance instanceof SpeakerEditor)) throw new Error('Missing editor.');
  return instance;
}
function field(
  harness: RouterTestingHarness,
  name: 'name' | 'email' | 'shortBio',
): HTMLInputElement | HTMLTextAreaElement {
  const input = harness.routeNativeElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `#speaker-${name}`,
  );
  if (!input) throw new Error('Missing field.');
  return input;
}
function type(
  harness: RouterTestingHarness,
  name: 'name' | 'email' | 'shortBio',
  value: string,
): void {
  const input = field(harness, name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function decide(accept: boolean): Promise<void> {
  await vi.waitFor(() => {
    expect(document.querySelector('.p-confirmdialog')).not.toBeNull();
  });
  const button = document.querySelector<HTMLButtonElement>(
    accept ? '.p-confirmdialog-accept-button' : '.p-confirmdialog-reject-button',
  );
  if (!button) throw new Error('Missing confirmation button.');
  button.click();
  await vi.waitFor(() => {
    expect(document.querySelector('.p-confirmdialog')).toBeNull();
  });
}

describe('Speaker editor forms and route lifecycle', () => {
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
  async function mount(suffix = '/new', language = 'en') {
    const harness = await RouterTestingHarness.create(
      path.replace('/en/', `/${language}/`) + suffix,
    );
    http.expectOne((request) => operation(request, 'AdminStores')).flush({ data: { stores } });
    await harness.fixture.whenStable();
    return harness;
  }

  it('validates required Name and the concrete speaker field before submitting with focus', async () => {
    const harness = await mount();
    const current = editor(harness);
    http.expectNone('/graphql');
    await current.save();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'name'));
    type(harness, 'name', 'Valid');
    type(harness, 'email', 'invalid');
    await current.save();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'email'));
    expect(harness.routeNativeElement?.textContent).toContain('valid email address');
    http.expectNone('/graphql');
  });
  it('enforces the service text limits by Unicode code points and rejects NUL', async () => {
    const harness = await mount();
    const form = editor(harness).form;
    form.controls.name.setValue('😀'.repeat(200));
    expect(form.controls.name.valid).toBe(true);
    form.controls.name.setValue('😀'.repeat(201));
    expect(form.controls.name.hasError('maxLength')).toBe(true);
    form.controls.name.setValue('NUL\u0000');
    expect(form.controls.name.hasError('unsupported')).toBe(true);
    form.controls.email.setValue('a'.repeat(255));
    expect(form.controls.email.hasError('maxLength')).toBe(true);
    form.controls.shortBio.setValue('😀'.repeat(2000));
    expect(form.controls.shortBio.valid).toBe(true);
    form.controls.shortBio.setValue('😀'.repeat(2001));
    expect(form.controls.shortBio.hasError('maxLength')).toBe(true);
    form.controls.shortBio.setValue('NUL\u0000');
    expect(form.controls.shortBio.hasError('unsupported')).toBe(true);
    http.expectNone('/graphql');
  });
  it('trims generated inputs, clears optional fields, preserves false and list context, and prevents duplicate submission', async () => {
    const harness = await mount('/new?pageSize=10&sort=name&order=asc&keep=yes#anchor');
    const current = editor(harness);
    type(harness, 'name', ' Created ');
    type(harness, 'email', ' ');
    type(harness, 'shortBio', ' ');
    current.form.controls.active.setValue(false);
    const saving = current.save();
    await current.save();
    const write = http.expectOne((request) => operation(request, 'AdminCreateSpeaker'));
    expect(write.request.headers.get('x-store-id')).toBe(storeA);
    expect(write.request.headers.get('Accept-Language')).toBe('en');
    expect(write.request.body).toMatchObject({
      variables: { input: { name: 'Created', email: null, shortBio: null, active: false } },
    });
    await harness.fixture.whenStable();
    expect(field(harness, 'name').disabled).toBe(true);
    write.flush({
      data: {
        createReferenceSpeaker: {
          ...record(),
          name: 'Created',
          email: null,
          shortBio: null,
          active: false,
          __typename: 'ReferenceSpeaker',
        },
      },
    });
    await saving;
    await harness.fixture.whenStable();
    http.expectOne((request) => operation(request, 'AdminSpeakers')).flush(list());
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?pageSize=10&sort=name&order=asc&keep=yes#anchor');
    expect(harness.routeNativeElement?.textContent).toContain('Speaker saved.');
  });
  it('keeps a dirty edit available after a server field error and focuses its owning control', async () => {
    const harness = await mount(`/${speakerA}/edit`);
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    type(harness, 'name', 'Duplicate');
    const saving = current.save();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateSpeaker'));
    write.flush({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            requestId: 'field-id',
            fieldErrors: [
              { path: 'name', message: 'Name already exists' },
              { path: 'outside', message: 'Ignore' },
            ],
          },
        },
      ],
    });
    await saving;
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'name'));
    expect(current.form.dirty).toBe(true);
    expect(current.pending()).toBe(false);
    expect(field(harness, 'name').value).toBe('Duplicate');
    expect(harness.routeNativeElement?.textContent).toContain('Name already exists');
    type(harness, 'name', 'Corrected');
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
  });
  it('rejects invalid speaker IDs without a read and never exposes a form for a missing speaker', async () => {
    const harness = await mount('/not-a-uuid/edit');
    expect(harness.routeNativeElement?.textContent).toContain('Invalid speaker ID');
    http.expectNone('/graphql');
    await harness.navigateByUrl(path + `/${speakerA}/edit`);
    http.expectOne('/graphql').flush({
      errors: [{ message: 'Speaker not found', extensions: { requestId: 'missing-id' } }],
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Speaker not found (missing-id)');
  });

  it('guards same-store ID changes and restores the active selector after rejected store navigation', async () => {
    const harness = await mount(`/${speakerA}/edit`);
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    const old = editor(harness);
    type(harness, 'name', 'Dirty edit');
    const shell: unknown = harness.routeDebugElement?.query(
      By.directive(AdminShell),
    ).componentInstance;
    if (!(shell instanceof AdminShell)) throw new Error('Missing shell.');
    shell.storeControl.setValue(storeB);
    await decide(false);
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + `/${speakerA}/edit`);
    expect(shell.storeControl.value).toBe(storeA);
    expect(harness.routeNativeElement?.querySelector('#active-store')?.textContent).toContain(
      'Sofia',
    );
    expect(field(harness, 'name').value).toBe('Dirty edit');
    http.expectNone('/graphql');
    const change = router.navigateByUrl(path + `/${speakerB}/edit`);
    await decide(true);
    await change;
    await harness.fixture.whenStable();
    expect(editor(harness)).not.toBe(old);
    expect(editor(harness).form.dirty).toBe(false);
    http.expectOne('/graphql').flush(detail(record(speakerB, storeA, 'Other speaker')));
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('Other speaker');
  });

  it('guards language navigation and requests the accepted editor in its new language', async () => {
    const harness = await mount();
    type(harness, 'name', 'Dirty create');
    const destination = path.replace('/en/', '/bg/') + '/new';
    const reject = router.navigateByUrl(destination);
    await decide(false);
    expect(await reject).toBe(false);
    expect(router.url).toBe(path + '/new');
    const accept = router.navigateByUrl(destination);
    await decide(true);
    await accept;
    await harness.fixture.whenStable();
    const discovery = http.expectOne('/graphql');
    expect(discovery.request.headers.get('Accept-Language')).toBe('bg');
    discovery.flush({ data: { stores } });
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('');
    expect(harness.routeNativeElement?.textContent).toContain('Създай лектор');
    http.expectNone('/graphql');
  });

  it('cancels an obsolete detail read and recreates the pristine editor on ID changes', async () => {
    const harness = await mount(`/${speakerA}/edit`);
    const old = editor(harness);
    const read = http.expectOne('/graphql');
    await harness.navigateByUrl(path + `/${speakerB}/edit`);
    expect(read.cancelled).toBe(true);
    expect(editor(harness)).not.toBe(old);
    http.expectOne('/graphql').flush(detail(record(speakerB, storeA, 'B')));
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('B');
  });

  it('never overwrites dirty fields from a later detail notification and handles beforeunload', async () => {
    const harness = await mount(`/${speakerA}/edit`);
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.retry();
    const refresh = http.expectOne('/graphql');
    type(harness, 'name', 'Draft');
    refresh.flush(detail(record(speakerA, storeA, 'Server update')));
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('Draft');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it.each(['new', 'id', 'store', 'language'])(
    'suppresses late successful update callbacks after switching %s',
    async (destination) => {
      const harness = await mount(`/${speakerA}/edit`);
      http.expectOne('/graphql').flush(detail());
      await harness.fixture.whenStable();
      const old = editor(harness);
      type(harness, 'name', 'Old submitted edit');
      const saving = old.save();
      const write = http.expectOne('/graphql');
      const url =
        destination === 'new'
          ? path + '/new'
          : destination === 'id'
            ? path + `/${speakerB}/edit`
            : destination === 'store'
              ? `/en/stores/${storeB}/reference/speakers/${speakerA}/edit`
              : path.replace('/en/', '/bg/') + `/${speakerA}/edit`;
      await harness.navigateByUrl(url);
      if (destination === 'language')
        http.expectOne((request) => operation(request, 'AdminStores')).flush({ data: { stores } });
      if (destination !== 'new')
        http
          .expectOne((request) => operation(request, 'AdminSpeaker'))
          .flush(
            detail(
              record(
                destination === 'id' ? speakerB : speakerA,
                destination === 'store' ? storeB : storeA,
                'Current editor',
              ),
            ),
          );
      await harness.fixture.whenStable();
      type(harness, 'name', 'Current draft');
      expect(write.cancelled).toBe(false);
      expect(write.request.headers.get('x-store-id')).toBe(storeA);
      expect(write.request.headers.get('Accept-Language')).toBe('en');
      write.flush({
        data: {
          updateReferenceSpeaker: {
            ...record(),
            name: 'Old result',
            __typename: 'ReferenceSpeaker',
          },
        },
      });
      await saving;
      await harness.fixture.whenStable();
      expect(router.url).toBe(url);
      expect(field(harness, 'name').value).toBe('Current draft');
      expect(editor(harness).pending()).toBe(false);
      expect(editor(harness).error()).toBeNull();
      http.expectNone('/graphql');
    },
  );

  it.each([true, false])(
    'isolates a late create result (success=%s) from the next same-store editor',
    async (success) => {
      const harness = await mount();
      const old = editor(harness);
      type(harness, 'name', 'Create');
      const saving = old.save();
      const write = http.expectOne('/graphql');
      const url = path + `/${speakerA}/edit`;
      await harness.navigateByUrl(url);
      http.expectOne('/graphql').flush(detail());
      await harness.fixture.whenStable();
      type(harness, 'name', 'Current draft');
      expect(write.cancelled).toBe(false);
      write.flush(
        success
          ? {
              data: {
                createReferenceSpeaker: {
                  ...record(),
                  name: 'Late create',
                  __typename: 'ReferenceSpeaker',
                },
              },
            }
          : { errors: [{ message: 'Late create failure' }] },
      );
      await saving;
      await harness.fixture.whenStable();
      expect(router.url).toBe(url);
      expect(field(harness, 'name').value).toBe('Current draft');
      expect(editor(harness).error()).toBeNull();
      http.expectNone('/graphql');
    },
  );
  it('retains write failures through background reads and offers read recovery without losing the draft', async () => {
    const harness = await mount('/' + speakerA + '/edit');
    http.expectOne((request) => operation(request, 'AdminSpeaker')).flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.retry();
    const background = http.expectOne((request) => operation(request, 'AdminSpeaker'));
    current.form.controls.name.setValue('Unsubmitted draft');
    current.form.markAsDirty();
    const saving = current.save();
    http
      .expectOne((request) => operation(request, 'AdminUpdateSpeaker'))
      .flush({
        errors: [
          {
            message: 'Write rejected',
            extensions: {
              requestId: 'write-rejected',
              fieldErrors: [{ path: 'name', message: 'Rejected field' }],
            },
          },
        ],
      });
    await saving;
    expect(current.failure()).toContain('write-rejected');
    background.flush(detail(record(speakerA, storeA, 'Server update')));
    await harness.fixture.whenStable();
    expect(current.failure()).toContain('write-rejected');
    expect(current.form.controls.name.value).toBe('Unsubmitted draft');
    expect(current.form.dirty).toBe(true);
    expect(
      Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).some(
        (button) => button.textContent.trim() === current.text().retry,
      ),
    ).toBe(false);
    current.form.controls.name.setValue('Corrected draft');
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
    current.retry();
    http
      .expectOne((request) => operation(request, 'AdminSpeaker'))
      .flush({
        errors: [{ message: 'Read unavailable', extensions: { requestId: 'read-unavailable' } }],
      });
    await harness.fixture.whenStable();
    current.form.controls.name.setValue('Continued draft');
    await harness.fixture.whenStable();
    expect(current.failure()).toContain('read-unavailable');
    const retry = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent.trim() === current.text().retry,
    );
    if (!retry) throw new Error('Missing read recovery button.');
    retry.click();
    http
      .expectOne((request) => operation(request, 'AdminSpeaker'))
      .flush(detail(record(speakerA, storeA, 'Server update')));
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
    expect(current.form.controls.name.value).toBe('Continued draft');
    expect(current.form.dirty).toBe(true);
  });
});
