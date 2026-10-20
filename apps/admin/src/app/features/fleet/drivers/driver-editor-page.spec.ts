import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  ROUTER_OUTLET_DATA,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import type { AdminDriverDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { WALL_CLOCK } from '../../../ui/clock';
import { DriverEditorPage } from './driver-editor-page';
import { driverDetails } from './driver-mapping';

const branch = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';
const clock = { __typename: 'FleetDataClock', businessDate: '2026-10-18' } as const;
const record: AdminDriverDetailsFragment & { readonly __typename: 'FleetDriver' } = {
  __typename: 'FleetDriver',
  id,
  branchId: branch,
  firstName: 'Elena',
  lastName: 'Petrova',
  employeeNumber: 'E-004',
  identificationKey: 'KEY-4',
  phone: '+359 888 123 456',
  email: 'e@example.test',
  licenseNumber: '285001234',
  licenseCategories: ['B', 'C', 'CE'],
  licenseExpiresOn: '2028-02-29',
  tachographCardNumber: 'BG12345678',
  tachographCardExpiresOn: '2029-01-01',
  status: 'ACTIVE',
  notes: 'First line\nSecond line',
  vehicles: [],
  documentStatus: 'VALID',
  distance30dKm: 200,
  tripCount30d: 3,
  drivingScore30d: 81.5,
  maneuversPer100Km30d: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
function snapshot(mode: 'create' | 'edit' | 'view', recordId = id) {
  const current = {
    data: { drawer: true, mode, ...(mode === 'create' ? {} : { recordParam: 'recordId' }) },
    paramMap: convertToParamMap({ branchId: branch, ...(mode === 'create' ? {} : { recordId }) }),
  };
  return { ...current, pathFromRoot: [current] };
}
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branch &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function dialog(): HTMLElement {
  const element = Array.from(document.querySelectorAll<HTMLElement>('.p-drawer[role="dialog"]')).at(
    -1,
  );
  if (!element) {
    throw new Error('Missing Driver drawer.');
  }
  return element;
}
function field(name: string): HTMLInputElement | HTMLTextAreaElement {
  const element = dialog().querySelector<HTMLInputElement | HTMLTextAreaElement>(`#driver-${name}`);
  if (!element) {
    throw new Error(`Missing Driver ${name} input.`);
  }
  return element;
}
function type(name: string, value: string): void {
  const input = field(name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Live Driver drawer adapter', () => {
  let http: HttpTestingController;
  const navigate = vi.fn<Router['navigate']>();
  const saved = vi.fn<DrawerHost['saved']>();
  const route = { snapshot: snapshot('create') };
  const fixtures: ComponentFixture<DriverEditorPage>[] = [];
  async function mount(mode: 'create' | 'edit' | 'view' = 'create', recordId = id) {
    route.snapshot = snapshot(mode, recordId);
    const fixture = TestBed.createComponent(DriverEditorPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    if (mode === 'create') {
      http
        .expectOne((request) => operation(request, 'AdminDriverContext'))
        .flush({ data: { fleetDataClock: clock } });
      await fixture.whenStable();
    }
    return fixture;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: ROUTER_OUTLET_DATA, useValue: signal({ saved } satisfies DrawerHost) },
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: WALL_CLOCK, useValue: () => Date.parse('2035-01-01T00:00:00.000Z') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'driver-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    navigate.mockReset().mockResolvedValue(true);
    saved.mockReset();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
  });
  afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
      fixture.destroy();
    }
    document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
      element.remove();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('creates with the real business date but without reading a record, then focuses the first invalid required field', async () => {
    const fixture = await mount();
    expect(fixture.componentInstance.businessDate()).toBe(clock.businessDate);
    const form = dialog().querySelector<HTMLFormElement>('#driver-form');
    if (!form) {
      throw new Error('Missing Driver form.');
    }
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(field('firstName').getAttribute('aria-invalid')).toBe('true');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field('firstName'));
    });
    http.expectNone('/graphql');
  });

  it('persists a manually typed expiry date after DatePicker blur through the generated create input', async () => {
    const fixture = await mount();
    type('firstName', 'Elena');
    type('lastName', 'Fleet');
    const expiry = field('licenseExpiresOn');
    const date = '2026-11-17';
    let entered = '';
    for (const key of date) {
      expiry.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      entered += key;
      expiry.value = entered;
      expiry.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expiry.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(expiry.value).toBe(date);
    type('notes', 'Typed calendar date');
    const form = dialog().querySelector<HTMLFormElement>('#driver-form');
    if (!form) {
      throw new Error('Missing Driver form.');
    }
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    const write = http.expectOne((request) => operation(request, 'AdminCreateDriver'));
    expect(write.request.body).toMatchObject({
      variables: {
        input: {
          firstName: 'Elena',
          lastName: 'Fleet',
          licenseExpiresOn: date,
          notes: 'Typed calendar date',
        },
      },
    });
    write.flush({
      data: {
        createFleetDriver: {
          ...record,
          lastName: 'Fleet',
          licenseExpiresOn: date,
          documentStatus: 'EXPIRING',
        },
      },
    });
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(saved).toHaveBeenCalledWith({ recordId: id, message: 'Elena Fleet was added.' });
    });
  });

  it('hydrates every document field and saves explicit clears once while preserving route context', async () => {
    const fixture = await mount('edit');
    http
      .expectOne((request) => operation(request, 'AdminDriver'))
      .flush({ data: { fleetDriver: record, fleetDataClock: clock } });
    await fixture.whenStable();
    expect(field('employeeNo').value).toBe('E-004');
    expect(field('identificationKey').value).toBe('KEY-4');
    expect(field('licenseNumber').value).toBe('285001234');
    expect(field('tachographCardNumber').value).toBe('BG12345678');
    const form = {
      ...driverDetails(record),
      employeeNo: ' ',
      licenseExpiresOn: null,
      tachoCardExpiresOn: null,
      notes: ' ',
    };
    const saving = fixture.componentInstance.save(form);
    await fixture.componentInstance.save(form);
    const write = http.expectOne((request) => operation(request, 'AdminUpdateDriver'));
    expect(write.request.body).toMatchObject({
      variables: {
        id,
        input: {
          employeeNumber: null,
          licenseExpiresOn: null,
          tachographCardExpiresOn: null,
          notes: null,
        },
      },
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.canLeave()).toBe(false);
    write.flush({ data: { updateFleetDriver: record } });
    await saving;
    expect(saved).toHaveBeenCalledWith({ recordId: id, message: 'Elena Petrova was saved.' });
    expect(navigate).toHaveBeenCalledWith(['/', 'en', branch, 'fleet', 'drivers'], {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  });

  it('retains a dirty draft and focuses mapped employee-number errors after a synchronous rejection', async () => {
    const fixture = await mount('edit');
    http
      .expectOne((request) => operation(request, 'AdminDriver'))
      .flush({ data: { fleetDriver: record, fleetDataClock: clock } });
    await fixture.whenStable();
    type('employeeNo', 'TAKEN');
    type('notes', 'Keep this draft');
    const saving = fixture.componentInstance.save({
      ...driverDetails(record),
      employeeNo: 'TAKEN',
      notes: 'Keep this draft',
    });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateDriver'));
    write.flush({
      errors: [
        {
          message: 'Duplicate employee number.',
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'employeeNumber', message: 'Duplicate employee number.' }],
          },
        },
      ],
    });
    await saving;
    await fixture.whenStable();
    expect(field('notes').value).toBe('Keep this draft');
    expect(field('employeeNo').getAttribute('aria-invalid')).toBe('true');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field('employeeNo'));
    });
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('routes read-only Edit and edited Cancel through the host URL transitions', async () => {
    const view = await mount('view');
    http
      .expectOne((request) => operation(request, 'AdminDriver'))
      .flush({ data: { fleetDriver: record, fleetDataClock: clock } });
    await view.whenStable();
    view.componentInstance.edit();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/', 'en', branch, 'fleet', 'drivers', id, 'edit'],
      expect.objectContaining({ queryParamsHandling: 'preserve' }),
    );
    view.componentInstance.viewRecord();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/', 'en', branch, 'fleet', 'drivers', id],
      expect.objectContaining({ queryParamsHandling: 'preserve' }),
    );
  });

  it('classifies read-only document dates against the returned business date instead of the browser clock', async () => {
    const view = await mount('view');
    http
      .expectOne((request) => operation(request, 'AdminDriver'))
      .flush({
        data: {
          fleetDriver: { ...record, licenseExpiresOn: '2026-11-17', documentStatus: 'EXPIRING' },
          fleetDataClock: clock,
        },
      });
    await view.whenStable();
    expect(view.componentInstance.businessDate()).toBe('2026-10-18');
    expect(dialog().textContent).toContain('Expires in 30 d');
    expect(dialog().textContent).not.toContain('Expired');
  });

  it('retries create context without loading any record or guessing a business date', async () => {
    route.snapshot = snapshot('create');
    const fixture = TestBed.createComponent(DriverEditorPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminDriverContext'))
      .flush('Offline', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.businessDate()).toBeNull();
    expect(fixture.componentInstance.state()).toBe('error');
    http.expectNone((request) => operation(request, 'AdminDriver'));
    const retry = [...dialog().querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Retry',
    );
    if (!retry) {
      throw new Error('Missing Driver context Retry.');
    }
    retry.click();
    http
      .expectOne((request) => operation(request, 'AdminDriverContext'))
      .flush({ data: { fleetDataClock: clock } });
    await fixture.whenStable();
    expect(fixture.componentInstance.businessDate()).toBe(clock.businessDate);
    expect(fixture.componentInstance.state()).toBe('ready');
  });

  it('does not read malformed IDs and exposes scoped missing records as not found', async () => {
    const invalid = await mount('edit', 'invalid');
    expect(invalid.componentInstance.state()).toBe('invalid-id');
    http.expectNone('/graphql');
    invalid.destroy();
    const missing = await mount('edit');
    http
      .expectOne((request) => operation(request, 'AdminDriver'))
      .flush({ errors: [{ message: 'Driver not found', extensions: { code: 'NOT_FOUND' } }] });
    await missing.whenStable();
    expect(missing.componentInstance.state()).toBe('not-found');
  });
});
