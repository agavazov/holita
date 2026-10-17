import { DemoSession } from '../../../core/auth/demo-session';
import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DeviceEditor } from './device-editor';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const deviceId = '20000000-0000-4000-8000-000000000001';
const truckId = '30000000-0000-4000-8000-000000000001';
const saved = {
  __typename: 'FleetDevice',
  id: deviceId,
  branchId: branchA,
  imei: '001234567890123',
  vehicleId: truckId,
  vehicle: { id: truckId, licensePlate: 'CA1234AB' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function element(fixture: ComponentFixture<DeviceEditor>): HTMLElement {
  const element: unknown = fixture.nativeElement;
  if (!(element instanceof HTMLElement)) throw new Error('Missing editor element');
  return element;
}
describe('Device editor validation and captured writes', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-demo-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
  });
  async function mount(id: string | null = null, branchId = branchA) {
    const fixture = TestBed.createComponent(DeviceEditor);
    fixture.componentRef.setInput('branch', { id: branchId, name: 'Branch' });
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('deviceId', id);
    await fixture.whenStable();
    return fixture;
  }
  async function chooseTruck(fixture: ComponentFixture<DeviceEditor>) {
    fixture.componentInstance.selectVehicle([truckId]);
    await fixture.whenStable();
    const lookup = http.expectOne((request) => operation(request, 'AdminDeviceVehicles'));
    expect(lookup.request.headers.get('x-branch-id')).toBe(branchA);
    lookup.flush({ data: { fleetVehicles: { items: [saved.vehicle], total: 1 } } });
    await fixture.whenStable();
  }
  it('focuses the required IMEI and truck, validates 15 digits and retains leading zeros', async () => {
    const fixture = await mount();
    await fixture.componentInstance.save();
    expect(document.activeElement).toBe(element(fixture).querySelector('#device-imei'));
    const form = fixture.componentInstance.form;
    for (const value of [
      '12345678901234',
      '1234567890123456',
      '12345678901234A',
      '１２３４５６７８９０１２３４５',
    ]) {
      form.controls.imei.setValue(value);
      expect(form.controls.imei.invalid).toBe(true);
    }
    form.controls.imei.setValue('001234567890123');
    await fixture.componentInstance.save();
    expect(document.activeElement).toBe(element(fixture).querySelector('#device-vehicleId'));
    http.expectNone('/graphql');
    fixture.destroy();
  });
  it('submits a typed input, displays duplicate IMEI errors and focuses the field', async () => {
    const fixture = await mount();
    fixture.componentInstance.form.controls.imei.setValue(' 001234567890123 ');
    await chooseTruck(fixture);
    const completion = fixture.componentInstance.save();
    const write = http.expectOne((request) => operation(request, 'AdminCreateDevice'));
    expect(write.request.body).toMatchObject({
      variables: { input: { imei: saved.imei, vehicleId: truckId } },
    });
    expect(fixture.componentInstance.form.disabled).toBe(true);
    write.flush({
      errors: [
        {
          message: 'Duplicate IMEI',
          extensions: {
            fieldErrors: [{ path: 'imei', message: 'IMEI is already used in this branch.' }],
          },
        },
      ],
    });
    await completion;
    await fixture.whenStable();
    expect(fixture.componentInstance.form.enabled).toBe(true);
    expect(document.activeElement).toBe(element(fixture).querySelector('#device-imei'));
    expect(element(fixture).textContent).toContain('IMEI is already used in this branch.');
    expect(fixture.componentInstance.form.controls.vehicleId.value).toBe(truckId);
    fixture.destroy();
  });
  it('hydrates the saved truck and rejects null clearing before an update', async () => {
    const fixture = await mount(deviceId);
    http
      .expectOne((request) => operation(request, 'AdminDevice'))
      .flush({ data: { fleetDevice: saved } });
    await fixture.whenStable();
    expect(fixture.componentInstance.ready()).toBe(true);
    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      imei: saved.imei,
      vehicleId: truckId,
    });
    expect(fixture.componentInstance.selectedVehicleIds()).toEqual([truckId]);
    http
      .expectOne((request) => operation(request, 'AdminDeviceVehicles'))
      .flush({ data: { fleetVehicles: { items: [saved.vehicle], total: 1 } } });
    await fixture.whenStable();
    expect(element(fixture).textContent).toContain('CA1234AB');
    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      imei: saved.imei,
      vehicleId: truckId,
    });
    expect(fixture.componentInstance.form.pristine).toBe(true);
    fixture.componentInstance.selectVehicle([]);
    await fixture.whenStable();
    await fixture.componentInstance.save();
    expect(fixture.componentInstance.form.controls.vehicleId.invalid).toBe(true);
    http.expectNone('/graphql');
    fixture.destroy();
  });
  it.each([true, false])(
    'retires late submitted write callbacks after navigation: success=%s',
    async (success) => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const old = await mount();
      old.componentInstance.form.controls.imei.setValue(saved.imei);
      await chooseTruck(old);
      const completion = old.componentInstance.save();
      const write = http.expectOne((request) => operation(request, 'AdminCreateDevice'));
      old.destroy();
      const next = await mount(null, branchB);
      expect(write.cancelled).toBe(false);
      expect(write.request.headers.get('x-branch-id')).toBe(branchA);
      write.flush(
        success
          ? { data: { createFleetDevice: saved } }
          : { errors: [{ message: 'Failed old write' }] },
      );
      await completion;
      await next.whenStable();
      expect(navigate).not.toHaveBeenCalled();
      expect(next.componentInstance.error()).toBeNull();
      expect(next.componentInstance.form.getRawValue()).toEqual({ imei: '', vehicleId: '' });
      next.destroy();
    },
  );
  it('cancels an obsolete detail read when the editor is destroyed', async () => {
    const old = await mount(deviceId);
    const read = http.expectOne((request) => operation(request, 'AdminDevice'));
    old.destroy();
    expect(read.cancelled).toBe(true);
  });
});
