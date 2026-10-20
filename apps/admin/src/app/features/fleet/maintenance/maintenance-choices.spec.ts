import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DemoSession } from '../../../core/auth/demo-session';
import { MaintenanceApi } from './maintenance-api';
import { MaintenanceChoices } from './maintenance-choices';
function operation(request: HttpRequest<unknown>): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === 'AdminServiceVehicles'
  );
}
describe('Maintenance vehicle choice pagination', () => {
  let http: HttpTestingController;
  let api: MaintenanceApi;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MaintenanceApi,
        MaintenanceChoices,
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    api = TestBed.inject(MaintenanceApi);
    api.initialize('10000000-0000-4000-8000-000000000001', 'en');
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    api.ngOnDestroy();
    http.verify({ ignoreCancelled: true });
  });
  it('loads every page using bounded requests and retains real inactive status for historical records', async () => {
    const choices = TestBed.inject(MaintenanceChoices);
    choices.load();
    const first = http.expectOne(operation);
    expect(first.request.body).toMatchObject({ variables: { offset: 0, limit: 100 } });
    first.flush({
      data: {
        fleetVehicles: {
          items: Array.from({ length: 100 }, (_, index) => ({
            id: `vehicle-${String(index)}`,
            licensePlate: `Plate ${String(index)}`,
            status: 'ACTIVE',
          })),
          total: 101,
          offset: 0,
          limit: 100,
        },
      },
    });
    await vi.waitFor(() => {
      http.expectOne(operation).flush({
        data: {
          fleetVehicles: {
            items: [{ id: 'historical', licensePlate: 'History', status: 'INACTIVE' }],
            total: 101,
            offset: 100,
            limit: 100,
          },
        },
      });
    });
    await vi.waitFor(() => {
      expect(choices.vehicles()).toHaveLength(101);
    });
    expect(choices.vehicles().at(-1)).toEqual({
      id: 'historical',
      name: 'History',
      status: 'INACTIVE',
    });
  });
  it('retains loaded choices on failure and retries without keeping an obsolete read', async () => {
    const choices = TestBed.inject(MaintenanceChoices);
    choices.load();
    http.expectOne(operation).flush({
      data: {
        fleetVehicles: {
          items: [{ id: 'vehicle', licensePlate: 'Plate', status: 'ACTIVE' }],
          total: 1,
          offset: 0,
          limit: 100,
        },
      },
    });
    await vi.waitFor(() => {
      expect(choices.vehicles()).toHaveLength(1);
    });
    choices.load();
    const obsolete = http.expectOne(operation);
    choices.load();
    expect(obsolete.cancelled).toBe(true);
    http.expectOne(operation).flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await vi.waitFor(() => {
      expect(choices.error()).not.toBeNull();
    });
    expect(choices.vehicles()).toHaveLength(1);
    choices.load();
    http
      .expectOne(operation)
      .flush({ data: { fleetVehicles: { items: [], total: 0, offset: 0, limit: 100 } } });
    await vi.waitFor(() => {
      expect(choices.error()).toBeNull();
      expect(choices.vehicles()).toEqual([]);
    });
  });
});
