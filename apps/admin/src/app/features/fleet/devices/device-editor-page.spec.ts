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
import type { AdminDeviceDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DeviceEditorPage } from './device-editor-page';
import { deviceForm } from './device-mapping';

const branch = '10000000-0000-4000-8000-000000000001',
  id = '60000000-0000-4000-8000-000000000001';
const device: AdminDeviceDetailsFragment = {
  id,
  branchId: branch,
  imei: '001234567890123',
  vehicleId: null,
  vehicle: null,
  model: 'STARLINK_TRACKER',
  options: ['CAN'],
  firmwareVersion: '2.26.1',
  simIccid: '8935901990012345678',
  simPhoneNumber: '+359888123456',
  installedAt: null,
  notes: 'First\nSecond',
  status: 'IN_STOCK',
  lastReportedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
function snapshot(mode: 'create' | 'edit', recordId = id, editFrom: string | null = null) {
  const current = {
    data: { drawer: true, mode, ...(mode === 'edit' ? { recordParam: 'recordId' } : {}) },
    paramMap: convertToParamMap({ branchId: branch, ...(mode === 'edit' ? { recordId } : {}) }),
    queryParamMap: convertToParamMap(editFrom ? { editFrom } : {}),
  };
  return { ...current, pathFromRoot: [current] };
}
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function field(name: string): HTMLInputElement | HTMLTextAreaElement {
  const element = document.getElementById('device-' + name);
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error('Missing Device field ' + name);
  }
  return element;
}
function submit(): void {
  const form = document.getElementById('device-form');
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Missing Device form.');
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
describe('Live Device routed editor', () => {
  let http: HttpTestingController;
  const hostSaved = vi.fn<DrawerHost['saved']>(),
    navigate = vi.fn<Router['navigate']>();
  const route = { snapshot: snapshot('create') };
  const fixtures: ComponentFixture<DeviceEditorPage>[] = [];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: ROUTER_OUTLET_DATA, useValue: signal({ saved: hostSaved }) },
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    navigate.mockReset().mockResolvedValue(true);
    hostSaved.mockReset();
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
  async function mount(
    mode: 'create' | 'edit' = 'create',
    recordId = id,
    editFrom: string | null = null,
  ) {
    route.snapshot = snapshot(mode, recordId, editFrom);
    const fixture = TestBed.createComponent(DeviceEditorPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    if (mode === 'create' || recordId === id) {
      http
        .expectOne((request) => operation(request, 'AdminDeviceVehicles'))
        .flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 100 } } });
      http
        .expectOne((request) => operation(request, 'AdminDeviceSummary'))
        .flush({
          data: { fleetDeviceSummary: { dataAsOf: null, online: 0, offline: 0, inStock: 1 } },
        });
      if (mode === 'edit') {
        http
          .expectOne((request) => operation(request, 'AdminDevice'))
          .flush({ data: { fleetDevice: { ...device, __typename: 'FleetDevice' } } });
      }
    }
    await fixture.whenStable();
    return fixture;
  }
  it('registers stock with IMEI zeros and no required model or Vehicle', async () => {
    const fixture = await mount();
    submit();
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field('imei'));
    });
    field('imei').value = '000000000000123';
    field('imei').dispatchEvent(new Event('input', { bubbles: true }));
    submit();
    const write = http.expectOne((request) => operation(request, 'AdminCreateDevice'));
    expect(write.request.body).toMatchObject({
      variables: {
        input: {
          imei: '000000000000123',
          vehicleId: null,
          model: null,
          options: [],
          notes: null,
          firmwareVersion: null,
          simPhoneNumber: null,
          simIccid: null,
          installedAt: null,
        },
      },
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.canLeave()).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      true,
    );
    write.flush({
      data: {
        createFleetDevice: { ...device, __typename: 'FleetDevice', imei: '000000000000123' },
      },
    });
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(hostSaved).toHaveBeenCalledOnce();
    });
    expect(navigate).toHaveBeenCalledWith(['/', 'en', branch, 'fleet', 'devices'], {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  });
  it('preserves all metadata and focuses an actual server options error without losing the draft', async () => {
    const fixture = await mount('edit');
    expect(field('notes').value).toBe('First\nSecond');
    field('notes').value = 'Changed';
    field('notes').dispatchEvent(new Event('input', { bubbles: true }));
    submit();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateDevice'));
    expect(write.request.body).toMatchObject({
      variables: {
        input: {
          model: 'STARLINK_TRACKER',
          options: ['CAN'],
          firmwareVersion: '2.26.1',
          simPhoneNumber: '+359888123456',
          simIccid: '8935901990012345678',
          notes: 'Changed',
        },
      },
    });
    write.flush({
      errors: [
        {
          message: 'Invalid options',
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldErrors: [{ path: 'options', message: 'Choose only compatible options.' }],
          },
        },
      ],
    });
    await fixture.whenStable();
    await vi.waitFor(() => {
      expect(document.activeElement?.id).toBe('device-options');
    });
    expect(field('notes').value).toBe('Changed');
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      false,
    );
    expect(hostSaved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('returns an overview-initiated edit to Diagnostics on Cancel and successful Save', async () => {
    const fixture = await mount('edit', id, 'diagnostics');
    const cancel = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Cancel',
    );
    expect(cancel).toBeDefined();
    cancel?.click();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/', 'en', branch, 'fleet', 'devices', id, 'diagnostics'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    const completion = fixture.componentInstance.save(deviceForm(device));
    http
      .expectOne((request) => operation(request, 'AdminUpdateDevice'))
      .flush({
        data: { updateFleetDevice: { ...device, __typename: 'FleetDevice' } },
      });
    await completion;
    expect(hostSaved).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/', 'en', branch, 'fleet', 'devices', id, 'diagnostics'],
      { queryParamsHandling: 'preserve', preserveFragment: true },
    );
  });
  it('ignores an unknown edit origin and keeps direct edits returning to the list', async () => {
    const fixture = await mount('edit', id, 'external');
    await fixture.componentInstance.close();
    expect(navigate).toHaveBeenCalledWith(['/', 'en', branch, 'fleet', 'devices'], {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  });
  it('lets a submitted write settle after retirement without notifying or navigating', async () => {
    const fixture = await mount('edit');
    const completion = fixture.componentInstance.save(deviceForm(device));
    const write = http.expectOne((request) => operation(request, 'AdminUpdateDevice'));
    fixture.destroy();
    expect(write.cancelled).toBe(false);
    write.flush({ data: { updateFleetDevice: { ...device, __typename: 'FleetDevice' } } });
    await completion;
    expect(hostSaved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('shares one discard confirmation for concurrent attempts to leave a dirty drawer', async () => {
    const fixture = await mount('edit');
    field('notes').value = 'Dirty draft';
    field('notes').dispatchEvent(new Event('input', { bubbles: true }));
    const first = Promise.resolve(fixture.componentInstance.canLeave());
    const second = Promise.resolve(fixture.componentInstance.canLeave());
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.p-confirmdialog')).toHaveLength(1);
    });
    const cancel = document.querySelector<HTMLButtonElement>('.p-confirmdialog-reject-button');
    if (!cancel) {
      throw new Error('Missing discard rejection.');
    }
    cancel.click();
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(field('notes').value).toBe('Dirty draft');
  });
  it('rejects malformed record IDs before issuing any business reads', async () => {
    const fixture = await mount('edit', 'invalid');
    expect(fixture.componentInstance.state()).toBe('invalid-id');
    http.expectNone('/graphql');
  });
});
