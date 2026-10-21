import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type { AdminDeviceDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DeviceDiagnosticsPage } from './device-diagnostics-page';

const branch = '10000000-0000-4000-8000-000000000001';
const id = '60000000-0000-4000-8000-000000000001';
const device: AdminDeviceDetailsFragment = {
  id,
  branchId: branch,
  imei: '001234567890123',
  vehicleId: null,
  vehicle: null,
  model: 'STARLINK_TRACKER',
  options: ['CAN'],
  firmwareVersion: '2.26.1',
  simIccid: null,
  simPhoneNumber: null,
  installedAt: null,
  notes: 'Stored notes',
  status: 'IN_STOCK',
  lastReportedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
function snapshot(recordId = id, editFrom: string | null = null) {
  const current = {
    data: { drawer: true, mode: 'view', recordParam: 'recordId' },
    paramMap: convertToParamMap({ branchId: branch, recordId }),
    queryParamMap: convertToParamMap(editFrom ? { editFrom } : {}),
  };
  return { ...current, pathFromRoot: [current] };
}
function operation(request: HttpRequest<unknown>): boolean {
  const body: unknown = request.body;
  return (
    request.headers.get('x-branch-id') === branch &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === 'AdminDevice'
  );
}
function dialog(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.p-drawer[role="dialog"]');
  if (!element) {
    throw new Error('Missing Device Diagnostics drawer.');
  }
  return element;
}
describe('Live Device read-only overview', () => {
  let http: HttpTestingController;
  const route = { snapshot: snapshot() };
  const navigate = vi.fn<Router['navigate']>();
  const fixtures: ComponentFixture<DeviceDiagnosticsPage>[] = [];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    navigate.mockReset().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
      element.remove();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  async function mount(recordId = id, editFrom: string | null = null) {
    route.snapshot = snapshot(recordId, editFrom);
    const fixture = TestBed.createComponent(DeviceDiagnosticsPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    return fixture;
  }
  it('shows stored metadata without a form and exposes a scoped explicit Edit action', async () => {
    const fixture = await mount();
    expect(dialog().querySelector('input')).toBeNull();
    fixture.componentInstance.edit();
    expect(navigate).not.toHaveBeenCalled();
    http
      .expectOne(operation)
      .flush({ data: { fleetDevice: { ...device, __typename: 'FleetDevice' } } });
    await fixture.whenStable();
    expect(dialog().textContent).toContain('Stored notes');
    expect(dialog().textContent).toContain('Unavailable');
    expect(dialog().querySelector('form')).toBeNull();
    const edit = [...dialog().querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Edit',
    );
    expect(edit).toBeDefined();
    edit?.click();
    expect(navigate).toHaveBeenCalledWith(['/', 'en', branch, 'fleet', 'devices', id, 'edit'], {
      queryParams: { editFrom: 'diagnostics' },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  });
  it('links the installed vehicle to its scoped profile without Device filters', async () => {
    const fixture = await mount();
    const vehicleId = '20000000-0000-4000-8000-000000000001';
    http.expectOne(operation).flush({
      data: {
        fleetDevice: {
          ...device,
          __typename: 'FleetDevice',
          vehicleId,
          vehicle: { id: vehicleId, licensePlate: 'CB 1001 AX' },
        },
      },
    });
    await fixture.whenStable();
    const link = [...dialog().querySelectorAll('a')].find(
      (anchor) => anchor.textContent.trim() === 'CB 1001 AX',
    );
    expect(link?.getAttribute('href')).toBe(`/en/${branch}/fleet/vehicles/${vehicleId}/overview`);
  });
  it('consumes the bounded edit return marker so subsequent direct edits keep list return behavior', async () => {
    const fixture = await mount(id, 'diagnostics');
    expect(navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { editFrom: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl: true,
    });
    http
      .expectOne(operation)
      .flush({ data: { fleetDevice: { ...device, __typename: 'FleetDevice' } } });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('ready');
  });
  it('exposes no Edit for invalid or missing records', async () => {
    const invalid = await mount('invalid');
    expect(invalid.componentInstance.state()).toBe('invalid-id');
    http.expectNone('/graphql');
    invalid.destroy();
    const missing = await mount();
    http
      .expectOne(operation)
      .flush({ errors: [{ message: 'Device not found.', extensions: { code: 'NOT_FOUND' } }] });
    await missing.whenStable();
    expect(missing.componentInstance.state()).toBe('not-found');
    missing.componentInstance.edit();
    expect(navigate).not.toHaveBeenCalled();
  });
});
