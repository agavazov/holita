import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { AdminDeviceDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DevicesPage } from './devices-list-page';

const branch = '10000000-0000-4000-8000-000000000001';
const firstId = '60000000-0000-4000-8000-000000000001',
  secondId = '60000000-0000-4000-8000-000000000002';
function device(id: string, imei: string): AdminDeviceDetailsFragment {
  return {
    id,
    branchId: branch,
    imei,
    vehicleId: null,
    vehicle: null,
    model: 'STARLINK_SCOUT',
    options: [],
    firmwareVersion: null,
    simIccid: null,
    simPhoneNumber: null,
    installedAt: null,
    notes: null,
    status: 'IN_STOCK',
    lastReportedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
const devices = [device(firstId, '000000000000001'), device(secondId, '000000000000002')];
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function list(items = devices) {
  return {
    data: {
      fleetDevices: {
        __typename: 'FleetDevicePage',
        items: items.map((record) => ({ ...record, __typename: 'FleetDevice' })),
        total: items.length,
        offset: 0,
        limit: 20,
      },
    },
  };
}
function summary(stock: number) {
  return {
    data: {
      fleetDeviceSummary: {
        __typename: 'FleetDeviceSummary',
        dataAsOf: null,
        online: 0,
        offline: 0,
        inStock: stock,
      },
    },
  };
}
describe('Live Devices list action lifecycle', () => {
  let http: HttpTestingController;
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
      token: 'tenant-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  it('opens Diagnostics from the primary IMEI while preserving direct row-menu editing', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DevicesPage);
    fixture.componentRef.setInput('branch', { id: branch, name: 'Fleet A' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    http.expectOne((request) => operation(request, 'AdminDeviceSummary')).flush(summary(2));
    http.expectOne((request) => operation(request, 'AdminDevices')).flush(list());
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Devices list.');
    }
    const open = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Open device 000000000000001"]',
    );
    expect(open).not.toBeNull();
    open?.click();
    expect(navigate).toHaveBeenLastCalledWith(
      [firstId, 'diagnostics'],
      expect.objectContaining({
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      }),
    );
    await fixture.componentInstance.run({ action: 'edit', ids: [firstId] });
    expect(navigate).toHaveBeenLastCalledWith(
      [firstId, 'edit'],
      expect.objectContaining({
        queryParamsHandling: 'preserve',
        preserveFragment: true,
      }),
    );
    fixture.destroy();
  });
  it('submits one batch, retains failed selections after a failed refresh and retries only the failure', async () => {
    const fixture = TestBed.createComponent(DevicesPage);
    fixture.componentRef.setInput('branch', { id: branch, name: 'Fleet A' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    http.expectOne((request) => operation(request, 'AdminDeviceSummary')).flush(summary(2));
    http.expectOne((request) => operation(request, 'AdminDevices')).flush(list());
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.selected.set(
      devices.map((record) => ({ id: record.id, label: record.imei, unavailable: [] })),
    );
    const notice = vi.spyOn(TestBed.inject(MessageService), 'add');
    const completion = page.run({ action: 'delete', ids: [firstId, secondId] });
    const write = http.expectOne((request) => operation(request, 'AdminDeleteDevices'));
    expect(write.request.body).toMatchObject({ variables: { ids: [firstId, secondId] } });
    write.flush({
      data: {
        deleteFleetDevices: {
          succeededIds: [firstId],
          failures: [{ id: secondId, code: 'SERVICE_UNAVAILABLE', message: 'Try again.' }],
        },
      },
    });
    await completion;
    http
      .expectOne((request) => operation(request, 'AdminDevices'))
      .flush({
        errors: [{ message: 'Refresh unavailable.', extensions: { code: 'SERVICE_UNAVAILABLE' } }],
      });
    http.expectOne((request) => operation(request, 'AdminDeviceSummary')).flush(summary(1));
    await fixture.whenStable();
    expect(page.selected().map((record) => record.id)).toEqual([secondId]);
    expect(notice).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        sticky: true,
        detail: '000000000000002: Try again.',
      }),
    );
    const retry = page.run({ action: 'delete', ids: [secondId] });
    const second = http.expectOne((request) => operation(request, 'AdminDeleteDevices'));
    expect(second.request.body).toMatchObject({ variables: { ids: [secondId] } });
    second.flush({ data: { deleteFleetDevices: { succeededIds: [secondId], failures: [] } } });
    await retry;
    http.expectOne((request) => operation(request, 'AdminDevices')).flush(list([]));
    http.expectOne((request) => operation(request, 'AdminDeviceSummary')).flush(summary(0));
    await fixture.whenStable();
    expect(page.selected()).toEqual([]);
    fixture.destroy();
  });
});
