import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  ActivatedRoute,
  ROUTER_OUTLET_DATA,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import type {
  AdminVehicleDetailsFragment,
  AdminVehicleDriversQuery,
  AdminVehicleGroupsQuery,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { VehicleEditorPage } from './vehicle-editor-page';
import { VehicleDrawer } from './vehicle-drawer';
import { vehicleForm } from './vehicle-mapping';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const vehicleId = '20000000-0000-4000-8000-000000000001';

function record(
  branchId = branchA,
  licensePlate = 'CA1234AB',
): AdminVehicleDetailsFragment & { readonly __typename: 'FleetVehicle' } {
  return {
    __typename: 'FleetVehicle',
    id: vehicleId,
    branchId,
    licensePlate,
    notes: 'First line\nSecond line',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    fleetNumber: 'T-04',
    vehicleType: 'TRACTOR',
    make: 'Volvo',
    model: 'FH',
    modelYear: 2024,
    vin: 'YV2RT40A1RB123456',
    fuelType: 'DIESEL',
    fuelTankCapacityL: 600,
    status: 'ACTIVE',
    groupId: null,
    group: null,
    currentDriverId: null,
    currentDriver: null,
    deviceCount: 0,
    openAlertCount: 0,
    state: {
      activity: 'NO_DEVICE',
      lastReportedAt: null,
      latitude: null,
      longitude: null,
      address: null,
      speedKph: null,
      headingDeg: null,
      ignition: null,
      fuelLevelPct: null,
      fuelStatus: 'NO_DATA',
      externalVoltage: null,
      backupBatteryVoltage: null,
      engineHours: null,
      coolantTempC: null,
      odometerKm: null,
      odometerRecordedAt: null,
      odometerSource: null,
    },
  };
}

function snapshot(mode: 'create' | 'edit', id: string, branchId: string) {
  const current = {
    data: { drawer: true, mode, ...(mode === 'edit' ? { recordParam: 'recordId' } : {}) },
    paramMap: convertToParamMap({ branchId, ...(mode === 'edit' ? { recordId: id } : {}) }),
  };
  return { ...current, pathFromRoot: [current] };
}

function operation(request: HttpRequest<unknown>, name: string, branchId = branchA): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branchId &&
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
    throw new Error('Missing current vehicle drawer.');
  }
  return element;
}

function clearOverlays(): void {
  document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
    element.remove();
  });
}

function field(
  name: 'plate' | 'fleetNumber' | 'vin' | 'make' | 'model' | 'notes',
): HTMLInputElement | HTMLTextAreaElement {
  const element = dialog().querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `#vehicle-${name}`,
  );
  if (!element) {
    throw new Error(`Missing vehicle ${name} input.`);
  }
  return element;
}

function type(name: Parameters<typeof field>[0], value: string): void {
  const input = field(name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submit(): void {
  const form = dialog().querySelector<HTMLFormElement>('#vehicle-form');
  if (!form) {
    throw new Error('Missing vehicle form.');
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('Vehicle editor drawer adapter', () => {
  let http: HttpTestingController;
  const navigateSpy = vi.fn<Router['navigate']>();
  const hostSaved = vi.fn<DrawerHost['saved']>();
  const host: DrawerHost = { saved: hostSaved };
  const route = { snapshot: snapshot('create', vehicleId, branchA) };
  const fixtures: ComponentFixture<VehicleEditorPage>[] = [];

  async function mount(
    mode: 'create' | 'edit' = 'create',
    id = vehicleId,
    branchId = branchA,
    driverOptions: AdminVehicleDriversQuery['fleetDrivers']['items'] = [],
    groupOptions: AdminVehicleGroupsQuery['fleetVehicleGroups']['items'] = [],
  ) {
    route.snapshot = snapshot(mode, id, branchId);
    const fixture = TestBed.createComponent(VehicleEditorPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    if (
      mode === 'create' ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      http
        .expectOne((request) => operation(request, 'AdminVehicleGroups', branchId))
        .flush({
          data: {
            fleetVehicleGroups: {
              items: groupOptions,
              total: groupOptions.length,
              offset: 0,
              limit: 100,
            },
          },
        });
      http
        .expectOne((request) => operation(request, 'AdminVehicleDrivers', branchId))
        .flush({
          data: {
            fleetDrivers: {
              items: driverOptions,
              total: driverOptions.length,
              offset: 0,
              limit: 100,
            },
          },
        });
    }
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: ROUTER_OUTLET_DATA, useValue: signal(host) },
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: {
        id: '01000000-0000-4000-8000-000000000001',
        name: 'Tenant A',
      },
    });
    http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    navigateSpy.mockReset().mockResolvedValue(true);
    hostSaved.mockReset();
    vi.spyOn(router, 'navigate').mockImplementation(navigateSpy);
  });

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
      fixture.destroy();
    }
    clearOverlays();
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('opens a create form without a detail read and focuses invalid input before submission', async () => {
    const fixture = await mount();
    expect(fixture.componentInstance.state()).toBe('ready');
    submit();
    await fixture.whenStable();
    expect(field('plate').getAttribute('aria-invalid')).toBe('true');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field('plate'));
    });
    type('plate', '😀'.repeat(33));
    submit();
    await fixture.whenStable();
    expect(field('plate').getAttribute('aria-invalid')).toBe('true');
    http.expectNone('/graphql');
  });

  it('captures one normalized create, disables the form, notifies its host and preserves list context on close', async () => {
    const fixture = await mount();
    type('plate', ' Created ');
    type('notes', ' ');
    const form = { ...vehicleForm(record()), plate: ' Created ', notes: ' ' };
    const saving = fixture.componentInstance.save(form);
    await fixture.componentInstance.save(form);
    const write = http.expectOne((request) => operation(request, 'AdminCreateVehicle'));
    expect(write.request.body).toMatchObject({
      variables: { input: { licensePlate: 'Created', notes: null } },
    });
    expect(write.request.headers.get('Accept-Language')).toBe('en');
    await fixture.whenStable();
    expect(field('plate').disabled).toBe(true);
    write.flush({ data: { createFleetVehicle: record(branchA, 'Created') } });
    await saving;
    await fixture.whenStable();
    expect(hostSaved).toHaveBeenCalledTimes(1);
    expect(hostSaved).toHaveBeenCalledWith({
      recordId: vehicleId,
      message: 'Created was created.',
    });
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/', 'en', branchA, 'fleet', 'vehicles'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });

  it('excludes inactive drivers from new assignments while retaining an existing inactive selection', async () => {
    const drivers: AdminVehicleDriversQuery['fleetDrivers']['items'] = [
      {
        id: '40000000-0000-4000-8000-000000000001',
        firstName: 'Active',
        lastName: 'Driver',
        status: 'ACTIVE',
      },
      {
        id: '40000000-0000-4000-8000-000000000002',
        firstName: 'On leave',
        lastName: 'Driver',
        status: 'ON_LEAVE',
      },
      {
        id: '40000000-0000-4000-8000-000000000003',
        firstName: 'Selected inactive',
        lastName: 'Driver',
        status: 'INACTIVE',
      },
      {
        id: '40000000-0000-4000-8000-000000000004',
        firstName: 'Other inactive',
        lastName: 'Driver',
        status: 'INACTIVE',
      },
    ];
    const create = await mount('create', vehicleId, branchA, drivers);
    const createDrawer: unknown = create.debugElement.query(
      By.directive(VehicleDrawer),
    ).componentInstance;
    if (!(createDrawer instanceof VehicleDrawer)) {
      throw new Error('Missing create drawer.');
    }
    expect(createDrawer.drivers().map((driver) => driver.name)).toEqual([
      'Active Driver',
      'On leave Driver',
    ]);
    create.destroy();
    clearOverlays();
    const edit = await mount('edit', vehicleId, branchA, drivers);
    const selectedId = '40000000-0000-4000-8000-000000000003';
    const assigned: AdminVehicleDetailsFragment = {
      ...record(),
      currentDriverId: selectedId,
      currentDriver: {
        id: selectedId,
        firstName: 'Selected inactive',
        lastName: 'Driver',
        status: 'INACTIVE',
      },
    };
    http
      .expectOne((request) => operation(request, 'AdminVehicle'))
      .flush({ data: { fleetVehicle: assigned } });
    await edit.whenStable();
    const editDrawer: unknown = edit.debugElement.query(
      By.directive(VehicleDrawer),
    ).componentInstance;
    if (!(editDrawer instanceof VehicleDrawer)) {
      throw new Error('Missing edit drawer.');
    }
    expect(editDrawer.drivers().map((driver) => driver.name)).toEqual([
      'Active Driver',
      'On leave Driver',
      'Selected inactive Driver',
    ]);
    expect(editDrawer.vehicle()?.driverId).toBe(selectedId);
    expect(field('plate').value).toBe('CA1234AB');
    http.expectNone('/graphql');
  });

  it('loads the rich edit record and retains its dirty draft after mapped server validation', async () => {
    const fixture = await mount('edit');
    const detail = http.expectOne((request) => operation(request, 'AdminVehicle'));
    expect(fixture.componentInstance.state()).toBe('loading');
    detail.flush({ data: { fleetVehicle: record() } });
    await fixture.whenStable();
    expect(field('fleetNumber').value).toBe('T-04');
    expect(field('vin').value).toBe('YV2RT40A1RB123456');
    expect(field('make').value).toBe('Volvo');
    expect(field('notes').value).toBe('First line\nSecond line');
    type('plate', 'Duplicate');
    const saving = fixture.componentInstance.save({ ...vehicleForm(record()), plate: 'Duplicate' });
    const update = http.expectOne((request) => operation(request, 'AdminUpdateVehicle'));
    update.flush({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            code: 'BAD_USER_INPUT',
            requestId: 'field-id',
            fieldErrors: [{ path: 'licensePlate', message: 'Duplicate plate.' }],
          },
        },
      ],
    });
    await saving;
    await fixture.whenStable();
    expect(field('plate').value).toBe('Duplicate');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field('plate'));
    });
    expect(document.body.textContent).toContain('Duplicate plate.');
    expect(document.body.textContent).toContain('field-id');
    expect(fixture.componentInstance.saving()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(hostSaved).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows and focuses a rejected group without losing the edited draft', async () => {
    const groupId = '30000000-0000-4000-8000-000000000001';
    const fixture = await mount(
      'edit',
      vehicleId,
      branchA,
      [],
      [{ id: groupId, name: 'Regional' }],
    );
    const assigned: AdminVehicleDetailsFragment = {
      ...record(),
      groupId,
      group: { id: groupId, name: 'Regional', colorToken: 'C2' },
    };
    http
      .expectOne((request) => operation(request, 'AdminVehicle'))
      .flush({ data: { fleetVehicle: assigned } });
    await fixture.whenStable();
    type('notes', 'Retain my draft.');
    const saving = fixture.componentInstance.save({
      ...vehicleForm(assigned),
      notes: 'Retain my draft.',
    });
    const update = http.expectOne((request) => operation(request, 'AdminUpdateVehicle'));
    expect(update.request.body).toMatchObject({ variables: { input: { groupId } } });
    update.flush({
      errors: [
        {
          message: 'Invalid input',
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'groupId', message: 'Choose a vehicle group in this branch.' }],
          },
        },
      ],
    });
    await saving;
    await fixture.whenStable();
    const group = dialog().querySelector<HTMLElement>('#vehicle-groupId');
    if (!group) {
      throw new Error('Missing vehicle group selector.');
    }
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.getAttribute('aria-describedby')).toContain('vehicle-groupId-error');
    expect(dialog().querySelector('#vehicle-groupId-error')?.textContent).toContain(
      'Choose a vehicle group in this branch.',
    );
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(group);
    });
    expect(field('notes').value).toBe('Retain my draft.');
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(hostSaved).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs before a detail read', async () => {
    const fixture = await mount('edit', 'not-a-uuid');
    expect(fixture.componentInstance.state()).toBe('invalid-id');
    expect(dialog().querySelector('.route-drawer__content')?.hasAttribute('hidden')).toBe(true);
    await fixture.componentInstance.save(vehicleForm(record()));
    http.expectNone('/graphql');
  });

  it('shows a missing record without exposing an editable form', async () => {
    const fixture = await mount('edit');
    http
      .expectOne((request) => operation(request, 'AdminVehicle'))
      .flush({
        errors: [
          {
            message: 'Vehicle not found',
            extensions: { code: 'NOT_FOUND', requestId: 'missing-id' },
          },
        ],
      });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('not-found');
    expect(dialog().querySelector('.route-drawer__content')?.hasAttribute('hidden')).toBe(true);
    await fixture.componentInstance.save(vehicleForm(record()));
    http.expectNone('/graphql');
    expect(hostSaved).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'isolates a retired create result (success=%s) from the next Branch editor',
    async (success) => {
      const old = await mount();
      const saving = old.componentInstance.save({ ...vehicleForm(record()), plate: 'Submitted A' });
      const write = http.expectOne((request) => operation(request, 'AdminCreateVehicle'));
      old.destroy();
      clearOverlays();
      const current = await mount('edit', vehicleId, branchB);
      http
        .expectOne((request) => operation(request, 'AdminVehicle', branchB))
        .flush({ data: { fleetVehicle: record(branchB, 'Current B') } });
      await current.whenStable();
      type('plate', 'Current draft');
      expect(write.cancelled).toBe(false);
      write.flush(
        success
          ? { data: { createFleetVehicle: record(branchA, 'Late A') } }
          : { errors: [{ message: 'Late create failure' }] },
      );
      await saving;
      await current.whenStable();
      expect(field('plate').value).toBe('Current draft');
      expect(current.componentInstance.saveError()).toBeNull();
      expect(current.componentInstance.saving()).toBe(false);
      expect(hostSaved).not.toHaveBeenCalled();
      expect(navigateSpy).not.toHaveBeenCalled();
      http.expectNone('/graphql');
    },
  );

  it('delegates dirty leave confirmation to the shared drawer and retains the form when rejected', async () => {
    const fixture = await mount();
    type('plate', 'Unsaved draft');
    const leaving = fixture.componentInstance.canLeave();
    await vi.waitFor(() => {
      expect(document.querySelector('.p-confirmdialog-reject-button')).not.toBeNull();
    });
    document.querySelector<HTMLButtonElement>('.p-confirmdialog-reject-button')?.click();
    expect(await leaving).toBe(false);
    expect(field('plate').value).toBe('Unsaved draft');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
