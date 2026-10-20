import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { AdminVehicleDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { VehiclesPage } from './vehicles-page';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const firstId = '20000000-0000-4000-8000-000000000001';
const secondId = '20000000-0000-4000-8000-000000000002';

function record(
  id = firstId,
  branchId = branchA,
): AdminVehicleDetailsFragment & { readonly __typename: 'FleetVehicle' } {
  return {
    __typename: 'FleetVehicle',
    id,
    branchId,
    licensePlate: id === firstId ? 'CA1234AB' : 'PB1234AB',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    fleetNumber: null,
    vehicleType: null,
    make: null,
    model: null,
    modelYear: null,
    vin: null,
    fuelType: null,
    fuelTankCapacityL: null,
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

function list(items: readonly AdminVehicleDetailsFragment[]) {
  return {
    data: {
      fleetVehicles: {
        __typename: 'FleetVehiclePage',
        items,
        total: items.length,
        offset: 0,
        limit: 20,
      },
    },
  };
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

describe('Vehicles live list actions and refresh', () => {
  let http: HttpTestingController;
  const noticeSpy = vi.fn<MessageService['add']>();
  const fixtures: ComponentFixture<VehiclesPage>[] = [];

  function flushSummary(branchId = branchA): void {
    http
      .expectOne((request) => operation(request, 'AdminVehicleSummary', branchId))
      .flush({
        data: {
          fleetVehicleSummary: {
            dataAsOf: null,
            inOperation: 2,
            inWorkshop: 0,
            moving: 0,
            notReporting: 0,
            openAlerts: 0,
            lowFuel: 0,
          },
        },
      });
  }

  async function mount(branchId = branchA): Promise<ComponentFixture<VehiclesPage>> {
    const fixture = TestBed.createComponent(VehiclesPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', {
      id: branchId,
      name: branchId === branchA ? 'Discordia' : 'Sandbox',
    });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroups', branchId))
      .flush({
        data: {
          fleetVehicleGroups: { items: [], total: 0, offset: 0, limit: 100 },
        },
      });
    http
      .expectOne((request) => operation(request, 'AdminVehicleDrivers', branchId))
      .flush({
        data: {
          fleetDrivers: { items: [], total: 0, offset: 0, limit: 100 },
        },
      });
    flushSummary(branchId);
    http
      .expectOne((request) => operation(request, 'AdminVehicles', branchId))
      .flush(list([record(firstId, branchId), record(secondId, branchId)]));
    await fixture.whenStable();
    fixture.componentInstance.selected.set([
      { id: firstId, label: 'CA1234AB', unavailable: [] },
      { id: secondId, label: 'PB1234AB', unavailable: [] },
    ]);
    return fixture;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
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
    const notices = TestBed.inject(MessageService);
    noticeSpy.mockReset();
    vi.spyOn(notices, 'add').mockImplementation(noticeSpy);
  });

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
      fixture.destroy();
    }
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it.each(['delete', 'deactivate'] as const)(
    'runs one %s batch, retains failed selections and retries only failures',
    async (action) => {
      const fixture = await mount();
      const page = fixture.componentInstance;
      const running = page.run({ action, ids: [firstId, secondId] });
      await page.run({ action, ids: [firstId] });
      expect(page.acting()).toBe(true);
      const operationName = action === 'delete' ? 'AdminDeleteVehicles' : 'AdminDeactivateVehicles';
      const field = action === 'delete' ? 'deleteFleetVehicles' : 'deactivateFleetVehicles';
      const batch = http.expectOne((request) => operation(request, operationName));
      expect(batch.request.body).toMatchObject({ variables: { ids: [firstId, secondId] } });
      batch.flush({
        data: {
          [field]: {
            succeededIds: [firstId],
            failures: [{ id: secondId, code: 'CONFLICT', message: 'Assigned tracker.' }],
          },
        },
      });
      await running;
      const remaining =
        action === 'delete'
          ? [record(secondId)]
          : [{ ...record(), status: 'INACTIVE' as const }, record(secondId)];
      http.expectOne((request) => operation(request, 'AdminVehicles')).flush(list(remaining));
      flushSummary();
      await fixture.whenStable();
      expect(page.selected().map((item) => item.id)).toEqual([secondId]);
      expect(page.acting()).toBe(false);
      expect(noticeSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: 'warn',
          detail: 'PB1234AB: Assigned tracker.',
          sticky: true,
        }),
      );
      const retry = page.run({ action, ids: page.selected().map((item) => item.id) });
      const retryWrite = http.expectOne((request) => operation(request, operationName));
      expect(retryWrite.request.body).toMatchObject({ variables: { ids: [secondId] } });
      retryWrite.flush({ data: { [field]: { succeededIds: [secondId], failures: [] } } });
      await retry;
      http
        .expectOne((request) => operation(request, 'AdminVehicles'))
        .flush(
          list(
            action === 'delete'
              ? []
              : [
                  { ...record(), status: 'INACTIVE' },
                  { ...record(secondId), status: 'INACTIVE' },
                ],
          ),
        );
      flushSummary();
      await fixture.whenStable();
      expect(page.selected()).toEqual([]);
      expect(noticeSpy).toHaveBeenLastCalledWith(expect.objectContaining({ severity: 'success' }));
    },
  );

  it('keeps rows and selection on a transport failure and includes its diagnostic request ID', async () => {
    const fixture = await mount();
    const page = fixture.componentInstance;
    const running = page.run({ action: 'delete', ids: [firstId, secondId] });
    http
      .expectOne((request) => operation(request, 'AdminDeleteVehicles'))
      .flush({
        errors: [
          {
            message: 'Deletion unavailable',
            extensions: { requestId: 'batch-request' },
          },
        ],
      });
    await running;
    expect(page.selected().map((item) => item.id)).toEqual([firstId, secondId]);
    expect(page.page()?.items).toHaveLength(2);
    expect(page.acting()).toBe(false);
    expect(noticeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Deletion unavailable (batch-request)',
        sticky: true,
      }),
    );
    http.expectNone('/graphql');
  });

  it.each([true, false])(
    'suppresses a retired batch result (success=%s) in the next Branch',
    async (success) => {
      const old = await mount();
      const running = old.componentInstance.run({ action: 'delete', ids: [firstId, secondId] });
      const write = http.expectOne((request) => operation(request, 'AdminDeleteVehicles'));
      old.destroy();
      const current = await mount(branchB);
      expect(write.cancelled).toBe(false);
      expect(write.request.headers.get('x-branch-id')).toBe(branchA);
      write.flush(
        success
          ? { data: { deleteFleetVehicles: { succeededIds: [firstId, secondId], failures: [] } } }
          : {
              errors: [{ message: 'Late deletion failure' }],
            },
      );
      await running;
      await current.whenStable();
      expect(current.componentInstance.page()?.items[0]?.branchId).toBe(branchB);
      expect(current.componentInstance.selected()).toHaveLength(2);
      expect(noticeSpy).not.toHaveBeenCalled();
      http.expectNone('/graphql');
    },
  );

  it('keeps loaded rows during a failed refresh and recovers without recreating the page', async () => {
    const fixture = await mount();
    const page = fixture.componentInstance;
    page.refresh();
    http
      .expectOne((request) => operation(request, 'AdminVehicles'))
      .flush({
        errors: [
          {
            message: 'Vehicles unavailable',
            extensions: { requestId: 'refresh-id' },
          },
        ],
      });
    flushSummary();
    await fixture.whenStable();
    expect(page.page()?.items).toHaveLength(2);
    expect(page.failure()).toContain('refresh-id');
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Vehicles page element.');
    }
    expect(element.textContent).toContain('CA1234AB');
    page.refresh();
    http.expectOne((request) => operation(request, 'AdminVehicles')).flush(list([record()]));
    flushSummary();
    await fixture.whenStable();
    expect(page.error()).toBeNull();
    expect(page.page()?.items).toHaveLength(1);
  });
});
