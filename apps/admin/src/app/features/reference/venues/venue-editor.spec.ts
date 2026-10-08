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
import { VenueEditor } from './venue-editor';
import type { AdminVenueFragment } from '../../../../generated/graphql/operations';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const venueA = '20000000-0000-4000-8000-000000000001';
const venueB = '20000000-0000-4000-8000-000000000002';
const path = `/en/stores/${storeA}/reference/venues`;
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
function record(id = venueA, storeId = storeA, name = 'Initial venue'): AdminVenueFragment {
  return {
    id,
    storeId,
    name,
    city: 'Sofia',
    countryCode: 'BG',
    description: null,
    address: null,
    capacity: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
function detail(venue = record()) {
  return { data: { referenceVenue: { ...venue, __typename: 'ReferenceVenue' } } };
}
function list(venue = record()) {
  return {
    data: {
      referenceVenues: {
        __typename: 'ReferenceVenuePage',
        items: [{ ...venue, __typename: 'ReferenceVenue' }],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}
function editor(harness: RouterTestingHarness): VenueEditor {
  const instance: unknown = harness.routeDebugElement?.query(
    By.directive(VenueEditor),
  ).componentInstance;
  if (!(instance instanceof VenueEditor)) throw new Error('Missing editor.');
  return instance;
}
function field(harness: RouterTestingHarness, name: 'name' | 'city'): HTMLInputElement {
  const input = harness.routeNativeElement?.querySelector<HTMLInputElement>(`#venue-${name}`);
  if (!input) throw new Error('Missing field.');
  return input;
}
function type(harness: RouterTestingHarness, name: 'name' | 'city', value: string): void {
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

describe('Venue editor forms and route lifecycle', () => {
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

  it('starts an active create form without business reads and validates required fields with focus', async () => {
    const harness = await mount();
    const current = editor(harness);
    expect(current.form.getRawValue()).toEqual({
      name: '',
      city: '',
      countryCode: 'BG',
      description: '',
      address: '',
      capacity: null,
      active: true,
    });
    await current.save();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'name'));
    expect(field(harness, 'name').getAttribute('aria-invalid')).toBe('true');
    expect(harness.routeNativeElement?.textContent).toContain('Name is required.');
    type(harness, 'name', ' Valid ');
    type(harness, 'city', '   ');
    await current.save();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'city'));
    http.expectNone('/graphql');
  });

  it('rejects NUL and oversized Unicode values, accepts exact limits and trims the generated create input', async () => {
    const harness = await mount();
    const current = editor(harness);
    type(harness, 'name', '😀'.repeat(201));
    type(harness, 'city', 'SKU\u0000');
    await current.save();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('at most 200');
    expect(harness.routeNativeElement?.textContent).toContain('unsupported character');
    http.expectNone('/graphql');
    type(harness, 'name', '  ' + '😀'.repeat(200) + '  ');
    type(harness, 'city', '😀'.repeat(121));
    await current.save();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('at most 120');
    http.expectNone('/graphql');
    type(harness, 'city', ' ' + '😀'.repeat(120) + ' ');
    const saving = current.save();
    const write = http.expectOne((request) => operation(request, 'AdminCreateVenue'));
    expect(write.request.body).toMatchObject({
      variables: {
        input: {
          name: '😀'.repeat(200),
          city: '😀'.repeat(120),
          countryCode: 'BG',
          description: null,
          address: null,
          capacity: null,
          active: true,
        },
      },
    });
    write.flush({ errors: [{ message: 'Test conflict' }] });
    await saving;
    await harness.fixture.whenStable();
    expect(current.form.dirty).toBe(true);
    expect(field(harness, 'city').value).toBe(' ' + '😀'.repeat(120) + ' ');
  });

  it('prevents duplicate submits, captures scope and returns to the preserved list URL with success feedback', async () => {
    const harness = await mount('/new?pageSize=10&sort=name&order=asc&keep=yes#anchor');
    const current = editor(harness);
    type(harness, 'name', ' Created ');
    type(harness, 'city', ' NEW ');
    const saving = current.save();
    await current.save();
    const write = http.expectOne((request) => operation(request, 'AdminCreateVenue'));
    expect(write.request.headers.get('x-store-id')).toBe(storeA);
    expect(write.request.headers.get('Accept-Language')).toBe('en');
    expect(write.request.body).toMatchObject({
      variables: {
        input: {
          name: 'Created',
          city: 'NEW',
          countryCode: 'BG',
          description: null,
          address: null,
          capacity: null,
          active: true,
        },
      },
    });
    await harness.fixture.whenStable();
    expect(field(harness, 'name').disabled).toBe(true);
    write.flush({
      data: {
        createReferenceVenue: {
          ...record(),
          name: 'Created',
          city: 'NEW',
          __typename: 'ReferenceVenue',
        },
      },
    });
    await saving;
    await harness.fixture.whenStable();
    http.expectOne((request) => operation(request, 'AdminVenues')).flush(list());
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?pageSize=10&sort=name&order=asc&keep=yes#anchor');
    expect(harness.routeNativeElement?.textContent).toContain('Venue saved.');
  });

  it('retries an initial detail failure and preserves dirty fields after a failed update', async () => {
    const harness = await mount(`/${venueA}/edit`);
    const current = editor(harness);
    const read = http.expectOne((request) => operation(request, 'AdminVenue'));
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    read.flush({
      errors: [{ message: 'Detail unavailable', extensions: { requestId: 'read-id' } }],
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('read-id');
    current.retry();
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    type(harness, 'name', 'Local edit');
    const saving = current.save();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateVenue'));
    expect(write.request.body).toMatchObject({
      variables: {
        id: venueA,
        input: {
          name: 'Local edit',
          city: 'Sofia',
          countryCode: 'BG',
          description: null,
          address: null,
          capacity: null,
          active: true,
        },
      },
    });
    write.flush({ errors: [{ message: 'Venue conflict', extensions: { requestId: 'write-id' } }] });
    await saving;
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('Local edit');
    expect(field(harness, 'name').disabled).toBe(false);
    expect(current.form.dirty).toBe(true);
    expect(harness.routeNativeElement?.textContent).toContain('Venue conflict (write-id)');
    const retry = current.save();
    http.expectOne('/graphql').flush({
      data: {
        updateReferenceVenue: { ...record(), name: 'Local edit', __typename: 'ReferenceVenue' },
      },
    });
    await retry;
    await harness.fixture.whenStable();
    http.expectOne('/graphql').flush(list());
    await harness.fixture.whenStable();
    expect(router.url).toBe(path);
  });

  it('shows a transport request ID and keeps the form available for retry', async () => {
    const harness = await mount();
    const current = editor(harness);
    type(harness, 'name', 'Name');
    type(harness, 'city', 'SKU');
    const saving = current.save();
    const write = http.expectOne('/graphql');
    const id = write.request.headers.get('x-request-id');
    write.error(new ProgressEvent('error'));
    await saving;
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain(id);
    expect(current.pending()).toBe(false);
    expect(field(harness, 'name').value).toBe('Name');
  });

  it('maps nullable fields, country and false activity, retains a rejected draft and focuses the server field', async () => {
    const harness = await mount(`/${venueA}/edit`);
    http.expectOne('/graphql').flush(
      detail({
        ...record(),
        description: 'Old description',
        address: 'Old address',
        capacity: 80,
      }),
    );
    await harness.fixture.whenStable();
    const current = editor(harness);
    type(harness, 'name', ' Draft ');
    current.form.patchValue({
      description: ' ',
      address: '',
      capacity: null,
      countryCode: ' us ',
      active: false,
    });
    const saving = current.save();
    const write = http.expectOne('/graphql');
    expect(write.request.body).toMatchObject({
      variables: {
        id: venueA,
        input: {
          name: 'Draft',
          description: null,
          address: null,
          capacity: null,
          countryCode: 'US',
          active: false,
        },
      },
    });
    write.flush({
      errors: [
        {
          message: 'Validation failed',
          extensions: {
            requestId: 'venue-field-error',
            fieldErrors: [{ path: 'city', message: 'City rejected' }],
          },
        },
      ],
    });
    await saving;
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'city'));
    expect(field(harness, 'city').getAttribute('aria-invalid')).toBe('true');
    expect(harness.routeNativeElement?.textContent).toContain('City rejected');
    expect(current.form.getRawValue()).toMatchObject({
      name: ' Draft ',
      description: ' ',
      capacity: null,
      active: false,
    });
    expect(current.form.dirty).toBe(true);
    type(harness, 'city', 'Boston');
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
  });

  it('rejects invalid venue IDs without a read and never exposes a form for a missing venue', async () => {
    const harness = await mount('/not-a-uuid/edit');
    expect(harness.routeNativeElement?.textContent).toContain('Invalid venue ID');
    http.expectNone('/graphql');
    await harness.navigateByUrl(path + `/${venueA}/edit`);
    http.expectOne('/graphql').flush({
      errors: [{ message: 'Venue not found', extensions: { requestId: 'missing-id' } }],
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Venue not found (missing-id)');
  });

  it('guards same-store ID changes and restores the active selector after rejected store navigation', async () => {
    const harness = await mount(`/${venueA}/edit`);
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
    expect(router.url).toBe(path + `/${venueA}/edit`);
    expect(shell.storeControl.value).toBe(storeA);
    expect(harness.routeNativeElement?.querySelector('#active-store')?.textContent).toContain(
      'Sofia',
    );
    expect(field(harness, 'name').value).toBe('Dirty edit');
    http.expectNone('/graphql');
    const change = router.navigateByUrl(path + `/${venueB}/edit`);
    await decide(true);
    await change;
    await harness.fixture.whenStable();
    expect(editor(harness)).not.toBe(old);
    expect(editor(harness).form.dirty).toBe(false);
    http.expectOne('/graphql').flush(detail(record(venueB, storeA, 'Other venue')));
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('Other venue');
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
    expect(harness.routeNativeElement?.textContent).toContain('Създай място');
    http.expectNone('/graphql');
  });

  it('cancels an obsolete detail read and recreates the pristine editor on ID changes', async () => {
    const harness = await mount(`/${venueA}/edit`);
    const old = editor(harness);
    const read = http.expectOne('/graphql');
    await harness.navigateByUrl(path + `/${venueB}/edit`);
    expect(read.cancelled).toBe(true);
    expect(editor(harness)).not.toBe(old);
    http.expectOne('/graphql').flush(detail(record(venueB, storeA, 'B')));
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('B');
  });

  it('never overwrites dirty fields from a later detail notification and handles beforeunload', async () => {
    const harness = await mount(`/${venueA}/edit`);
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.retry();
    const refresh = http.expectOne('/graphql');
    type(harness, 'name', 'Draft');
    refresh.flush(detail(record(venueA, storeA, 'Server update')));
    await harness.fixture.whenStable();
    expect(field(harness, 'name').value).toBe('Draft');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it.each(['new', 'id', 'store', 'language'])(
    'suppresses late successful update callbacks after switching %s',
    async (destination) => {
      const harness = await mount(`/${venueA}/edit`);
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
            ? path + `/${venueB}/edit`
            : destination === 'store'
              ? `/en/stores/${storeB}/reference/venues/${venueA}/edit`
              : path.replace('/en/', '/bg/') + `/${venueA}/edit`;
      await harness.navigateByUrl(url);
      if (destination === 'language')
        http.expectOne((request) => operation(request, 'AdminStores')).flush({ data: { stores } });
      if (destination !== 'new')
        http
          .expectOne((request) => operation(request, 'AdminVenue'))
          .flush(
            detail(
              record(
                destination === 'id' ? venueB : venueA,
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
          updateReferenceVenue: { ...record(), name: 'Old result', __typename: 'ReferenceVenue' },
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
      type(harness, 'city', 'SKU');
      const saving = old.save();
      const write = http.expectOne('/graphql');
      const url = path + `/${venueA}/edit`;
      await harness.navigateByUrl(url);
      http.expectOne('/graphql').flush(detail());
      await harness.fixture.whenStable();
      type(harness, 'name', 'Current draft');
      expect(write.cancelled).toBe(false);
      write.flush(
        success
          ? {
              data: {
                createReferenceVenue: {
                  ...record(),
                  name: 'Late create',
                  __typename: 'ReferenceVenue',
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
    const harness = await mount('/' + venueA + '/edit');
    http.expectOne((request) => operation(request, 'AdminVenue')).flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.retry();
    const background = http.expectOne((request) => operation(request, 'AdminVenue'));
    current.form.controls.name.setValue('Unsubmitted draft');
    current.form.markAsDirty();
    const saving = current.save();
    http
      .expectOne((request) => operation(request, 'AdminUpdateVenue'))
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
    background.flush(detail(record(venueA, storeA, 'Server update')));
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
      .expectOne((request) => operation(request, 'AdminVenue'))
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
      .expectOne((request) => operation(request, 'AdminVenue'))
      .flush(detail(record(venueA, storeA, 'Server update')));
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
    expect(current.form.controls.name.value).toBe('Continued draft');
    expect(current.form.dirty).toBe(true);
  });
});
