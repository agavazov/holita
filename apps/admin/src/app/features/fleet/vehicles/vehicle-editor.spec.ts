import { DemoSession } from '../../../core/auth/demo-session';
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
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { VehicleEditor } from './vehicle-editor';
import type { AdminVehicleFragment } from '../../../../generated/graphql/operations';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const vehicleA = '20000000-0000-4000-8000-000000000001';
const vehicleB = '20000000-0000-4000-8000-000000000002';
const path = `/en/${branchA}/fleet/vehicles`;
const branches = [
  { id: branchA, name: 'Discordia' },
  { id: branchB, name: 'Sandbox' },
];
function operation(request: HttpRequest<unknown>, licensePlate: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === licensePlate
  );
}
function record(
  id = vehicleA,
  branchId = branchA,
  licensePlate = 'Initial vehicle',
): AdminVehicleFragment {
  return {
    id,
    branchId,
    licensePlate,
    notes: 'Initial notes',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
function detail(vehicle = record()) {
  return { data: { fleetVehicle: { ...vehicle, __typename: 'FleetVehicle' } } };
}
function list(vehicle = record()) {
  return {
    data: {
      fleetVehicles: {
        __typename: 'FleetVehiclePage',
        items: [{ ...vehicle, __typename: 'FleetVehicle' }],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}
function editor(harness: RouterTestingHarness): VehicleEditor {
  const instance: unknown = harness.routeDebugElement?.query(
    By.directive(VehicleEditor),
  ).componentInstance;
  if (!(instance instanceof VehicleEditor)) throw new Error('Missing editor.');
  return instance;
}
function field(
  harness: RouterTestingHarness,
  licensePlate: 'licensePlate' | 'notes',
): HTMLInputElement | HTMLTextAreaElement {
  const input = harness.routeNativeElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `#vehicle-${licensePlate}`,
  );
  if (!input) throw new Error('Missing field.');
  return input;
}
function type(
  harness: RouterTestingHarness,
  licensePlate: 'licensePlate' | 'notes',
  value: string,
): void {
  const input = field(harness, licensePlate);
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

describe('Vehicle editor forms and route lifecycle', () => {
  let http: HttpTestingController;
  let router: Router;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminWorkspace, FleetWorkspace],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
      ],
    }).compileComponents();
    TestBed.inject(DemoSession).start({
      token: 'test-demo-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' },
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
    http.expectOne((request) => operation(request, 'AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    return harness;
  }

  it('validates the required license plate before submitting with focus', async () => {
    const harness = await mount();
    const current = editor(harness);
    http.expectNone('/graphql');
    await current.save();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'licensePlate'));
    type(harness, 'licensePlate', 'Valid');
    http.expectNone('/graphql');
  });
  it('enforces the service text limits by Unicode code points and rejects NUL', async () => {
    const harness = await mount();
    const form = editor(harness).form;
    form.controls.licensePlate.setValue('😀'.repeat(32));
    expect(form.controls.licensePlate.valid).toBe(true);
    form.controls.licensePlate.setValue('😀'.repeat(33));
    expect(form.controls.licensePlate.hasError('maxLength')).toBe(true);
    form.controls.licensePlate.setValue('NUL\u0000');
    expect(form.controls.licensePlate.hasError('unsupported')).toBe(true);
    form.controls.notes.setValue('😀'.repeat(2000));
    expect(form.controls.notes.valid).toBe(true);
    form.controls.notes.setValue('😀'.repeat(2001));
    expect(form.controls.notes.hasError('maxLength')).toBe(true);
    form.controls.notes.setValue('NUL\u0000');
    expect(form.controls.notes.hasError('unsupported')).toBe(true);
    http.expectNone('/graphql');
  });
  it('trims generated inputs, clears optional fields, preserves list context, and prevents duplicate submission', async () => {
    const harness = await mount('/new?pageSize=10&sort=licensePlate&order=asc&keep=yes#anchor');
    const current = editor(harness);
    type(harness, 'licensePlate', ' Created ');
    type(harness, 'notes', ' ');
    const saving = current.save();
    await current.save();
    const write = http.expectOne((request) => operation(request, 'AdminCreateVehicle'));
    expect(write.request.headers.get('x-branch-id')).toBe(branchA);
    expect(write.request.headers.get('Accept-Language')).toBe('en');
    expect(write.request.body).toMatchObject({
      variables: { input: { licensePlate: 'Created', notes: null } },
    });
    await harness.fixture.whenStable();
    expect(field(harness, 'licensePlate').disabled).toBe(true);
    write.flush({
      data: {
        createFleetVehicle: {
          ...record(),
          licensePlate: 'Created',
          notes: null,
          __typename: 'FleetVehicle',
        },
      },
    });
    await saving;
    await harness.fixture.whenStable();
    http.expectOne((request) => operation(request, 'AdminVehicles')).flush(list());
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?pageSize=10&sort=licensePlate&order=asc&keep=yes#anchor');
    expect(harness.routeNativeElement?.textContent).toContain('Vehicle saved.');
  });
  it('keeps a dirty edit available after a server field error and focuses its owning control', async () => {
    const harness = await mount(`/${vehicleA}/edit`);
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    type(harness, 'licensePlate', 'Duplicate');
    const saving = current.save();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateVehicle'));
    write.flush({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            requestId: 'field-id',
            fieldErrors: [
              { path: 'licensePlate', message: 'Invalid license plate' },
              { path: 'outside', message: 'Ignore' },
            ],
          },
        },
      ],
    });
    await saving;
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(field(harness, 'licensePlate'));
    expect(current.form.dirty).toBe(true);
    expect(current.pending()).toBe(false);
    expect(field(harness, 'licensePlate').value).toBe('Duplicate');
    expect(harness.routeNativeElement?.textContent).toContain('Invalid license plate');
    type(harness, 'licensePlate', 'Corrected');
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
  });
  it('rejects invalid vehicle IDs without a read and never exposes a form for a missing vehicle', async () => {
    const harness = await mount('/not-a-uuid/edit');
    expect(harness.routeNativeElement?.textContent).toContain('Invalid vehicle ID');
    http.expectNone('/graphql');
    await harness.navigateByUrl(path + `/${vehicleA}/edit`);
    http.expectOne('/graphql').flush({
      errors: [{ message: 'Vehicle not found', extensions: { requestId: 'missing-id' } }],
    });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Vehicle not found (missing-id)');
  });

  it('guards same-branch ID changes and keeps the active Branch after rejected branch navigation', async () => {
    const harness = await mount(`/${vehicleA}/edit`);
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    const old = editor(harness);
    type(harness, 'licensePlate', 'Dirty edit');
    const shell: unknown = harness.routeDebugElement?.query(
      By.directive(AdminShell),
    ).componentInstance;
    if (!(shell instanceof AdminShell)) throw new Error('Missing shell.');
    shell.chooseBranch(branchB);
    await decide(false);
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + `/${vehicleA}/edit`);
    expect(harness.routeNativeElement?.querySelector('#active-branch')?.textContent).toContain(
      'Discordia',
    );
    expect(field(harness, 'licensePlate').value).toBe('Dirty edit');
    http.expectNone('/graphql');
    const change = router.navigateByUrl(path + `/${vehicleB}/edit`);
    await decide(true);
    await change;
    await harness.fixture.whenStable();
    expect(editor(harness)).not.toBe(old);
    expect(editor(harness).form.dirty).toBe(false);
    http.expectOne('/graphql').flush(detail(record(vehicleB, branchA, 'Other vehicle')));
    await harness.fixture.whenStable();
    expect(field(harness, 'licensePlate').value).toBe('Other vehicle');
  });

  it('guards language navigation and requests the accepted editor in its new language', async () => {
    const harness = await mount();
    type(harness, 'licensePlate', 'Dirty create');
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
    discovery.flush({ data: { branches } });
    await harness.fixture.whenStable();
    expect(field(harness, 'licensePlate').value).toBe('');
    expect(harness.routeNativeElement?.textContent).toContain('Нов автомобил');
    http.expectNone('/graphql');
  });

  it('cancels an obsolete detail read and recreates the pristine editor on ID changes', async () => {
    const harness = await mount(`/${vehicleA}/edit`);
    const old = editor(harness);
    const read = http.expectOne('/graphql');
    await harness.navigateByUrl(path + `/${vehicleB}/edit`);
    expect(read.cancelled).toBe(true);
    expect(editor(harness)).not.toBe(old);
    http.expectOne('/graphql').flush(detail(record(vehicleB, branchA, 'B')));
    await harness.fixture.whenStable();
    expect(field(harness, 'licensePlate').value).toBe('B');
  });

  it('never overwrites dirty fields from a later detail notification and handles beforeunload', async () => {
    const harness = await mount(`/${vehicleA}/edit`);
    http.expectOne('/graphql').flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.retry();
    const refresh = http.expectOne('/graphql');
    type(harness, 'licensePlate', 'Draft');
    refresh.flush(detail(record(vehicleA, branchA, 'Server update')));
    await harness.fixture.whenStable();
    expect(field(harness, 'licensePlate').value).toBe('Draft');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it.each(['new', 'id', 'branch', 'language'])(
    'suppresses late successful update callbacks after switching %s',
    async (destination) => {
      const harness = await mount(`/${vehicleA}/edit`);
      http.expectOne('/graphql').flush(detail());
      await harness.fixture.whenStable();
      const old = editor(harness);
      type(harness, 'licensePlate', 'Old submitted edit');
      const saving = old.save();
      const write = http.expectOne('/graphql');
      const url =
        destination === 'new'
          ? path + '/new'
          : destination === 'id'
            ? path + `/${vehicleB}/edit`
            : destination === 'branch'
              ? `/en/${branchB}/fleet/vehicles/${vehicleA}/edit`
              : path.replace('/en/', '/bg/') + `/${vehicleA}/edit`;
      await harness.navigateByUrl(url);
      if (destination === 'language')
        http
          .expectOne((request) => operation(request, 'AdminBranches'))
          .flush({ data: { branches } });
      if (destination !== 'new')
        http
          .expectOne((request) => operation(request, 'AdminVehicle'))
          .flush(
            detail(
              record(
                destination === 'id' ? vehicleB : vehicleA,
                destination === 'branch' ? branchB : branchA,
                'Current editor',
              ),
            ),
          );
      await harness.fixture.whenStable();
      type(harness, 'licensePlate', 'Current draft');
      expect(write.cancelled).toBe(false);
      expect(write.request.headers.get('x-branch-id')).toBe(branchA);
      expect(write.request.headers.get('Accept-Language')).toBe('en');
      write.flush({
        data: {
          updateFleetVehicle: {
            ...record(),
            licensePlate: 'Old result',
            __typename: 'FleetVehicle',
          },
        },
      });
      await saving;
      await harness.fixture.whenStable();
      expect(router.url).toBe(url);
      expect(field(harness, 'licensePlate').value).toBe('Current draft');
      expect(editor(harness).pending()).toBe(false);
      expect(editor(harness).error()).toBeNull();
      http.expectNone('/graphql');
    },
  );

  it.each([true, false])(
    'isolates a late create result (success=%s) from the next same-branch editor',
    async (success) => {
      const harness = await mount();
      const old = editor(harness);
      type(harness, 'licensePlate', 'Create');
      const saving = old.save();
      const write = http.expectOne('/graphql');
      const url = path + `/${vehicleA}/edit`;
      await harness.navigateByUrl(url);
      http.expectOne('/graphql').flush(detail());
      await harness.fixture.whenStable();
      type(harness, 'licensePlate', 'Current draft');
      expect(write.cancelled).toBe(false);
      write.flush(
        success
          ? {
              data: {
                createFleetVehicle: {
                  ...record(),
                  licensePlate: 'Late create',
                  __typename: 'FleetVehicle',
                },
              },
            }
          : { errors: [{ message: 'Late create failure' }] },
      );
      await saving;
      await harness.fixture.whenStable();
      expect(router.url).toBe(url);
      expect(field(harness, 'licensePlate').value).toBe('Current draft');
      expect(editor(harness).error()).toBeNull();
      http.expectNone('/graphql');
    },
  );
  it('retains write failures through background reads and offers read recovery without losing the draft', async () => {
    const harness = await mount('/' + vehicleA + '/edit');
    http.expectOne((request) => operation(request, 'AdminVehicle')).flush(detail());
    await harness.fixture.whenStable();
    const current = editor(harness);
    current.retry();
    const background = http.expectOne((request) => operation(request, 'AdminVehicle'));
    current.form.controls.licensePlate.setValue('Unsubmitted draft');
    current.form.markAsDirty();
    const saving = current.save();
    http
      .expectOne((request) => operation(request, 'AdminUpdateVehicle'))
      .flush({
        errors: [
          {
            message: 'Write rejected',
            extensions: {
              requestId: 'write-rejected',
              fieldErrors: [{ path: 'licensePlate', message: 'Rejected field' }],
            },
          },
        ],
      });
    await saving;
    expect(current.failure()).toContain('write-rejected');
    background.flush(detail(record(vehicleA, branchA, 'Server update')));
    await harness.fixture.whenStable();
    expect(current.failure()).toContain('write-rejected');
    expect(current.form.controls.licensePlate.value).toBe('Unsubmitted draft');
    expect(current.form.dirty).toBe(true);
    expect(
      Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).some(
        (button) => button.textContent.trim() === current.text().retry,
      ),
    ).toBe(false);
    current.form.controls.licensePlate.setValue('Corrected draft');
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
    current.retry();
    http
      .expectOne((request) => operation(request, 'AdminVehicle'))
      .flush({
        errors: [{ message: 'Read unavailable', extensions: { requestId: 'read-unavailable' } }],
      });
    await harness.fixture.whenStable();
    current.form.controls.licensePlate.setValue('Continued draft');
    await harness.fixture.whenStable();
    expect(current.failure()).toContain('read-unavailable');
    const retry = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent.trim() === current.text().retry,
    );
    if (!retry) throw new Error('Missing read recovery button.');
    retry.click();
    http
      .expectOne((request) => operation(request, 'AdminVehicle'))
      .flush(detail(record(vehicleA, branchA, 'Server update')));
    await harness.fixture.whenStable();
    expect(current.error()).toBeNull();
    expect(current.form.controls.licensePlate.value).toBe('Continued draft');
    expect(current.form.dirty).toBe(true);
  });
});
