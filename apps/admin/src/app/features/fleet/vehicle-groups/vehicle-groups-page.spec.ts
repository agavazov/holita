import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DemoSession } from '../../../core/auth/demo-session';
import { VehicleGroupsPage } from './vehicle-groups-page';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const group = {
  __typename: 'FleetVehicleGroup',
  id: '30000000-0000-4000-8000-000000000001',
  branchId: branchA,
  name: 'Regional',
  description: null,
  colorToken: 'C1',
  vehicleCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

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

describe('Live Vehicle groups list', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<VehicleGroupsPage>[] = [];
  const notice = vi.fn<MessageService['add']>();
  async function mount(branchId = branchA) {
    const fixture = TestBed.createComponent(VehicleGroupsPage);
    fixture.componentRef.setInput('branch', { id: branchId, name: 'Fleet' });
    fixture.componentRef.setInput('language', 'en');
    fixtures.push(fixture);
    await fixture.whenStable();
    return fixture;
  }
  function page(items = [group], total = items.length, offset = 0) {
    return {
      data: { fleetVehicleGroups: { items, total, offset, limit: 100, ungroupedVehicleCount: 0 } },
    };
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
    TestBed.overrideComponent(VehicleGroupsPage, { set: { template: '' } });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    notice.mockReset();
    vi.spyOn(TestBed.inject(MessageService), 'add').mockImplementation(notice);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('loads every bounded page before showing the complete short list', async () => {
    const fixture = await mount();
    const first = Array.from({ length: 100 }, (_, index) => ({
      ...group,
      id: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    }));
    const request = http.expectOne((request) => operation(request, 'AdminVehicleGroupsList'));
    expect(request.request.body).toMatchObject({ variables: { offset: 0, limit: 100 } });
    request.flush(page(first, 101));
    await fixture.whenStable();
    expect(fixture.componentInstance.groups()).toBeNull();
    const second = http.expectOne((request) => operation(request, 'AdminVehicleGroupsList'));
    expect(second.request.body).toMatchObject({ variables: { offset: 100, limit: 100 } });
    second.flush(page([{ ...group, id: '30000000-0000-4000-8000-000000000101' }], 101, 100));
    await fixture.whenStable();
    expect(fixture.componentInstance.groups()).toHaveLength(101);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('retains known rows after refresh failure and recovers on retry', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminVehicleGroupsList')).flush(page());
    await fixture.whenStable();
    fixture.componentInstance.refresh();
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroupsList'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.groups()?.[0]?.name).toBe('Regional');
    expect(fixture.componentInstance.error()).not.toBeNull();
    fixture.componentInstance.refresh();
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroupsList'))
      .flush(page([{ ...group, name: 'Updated' }]));
    await fixture.whenStable();
    expect(fixture.componentInstance.groups()?.[0]?.name).toBe('Updated');
    expect(fixture.componentInstance.error()).toBeNull();
  });

  it('retires an obsolete whole-list load before starting its replacement', async () => {
    const fixture = await mount();
    const old = http.expectOne((request) => operation(request, 'AdminVehicleGroupsList'));
    fixture.componentInstance.refresh();
    expect(old.cancelled).toBe(true);
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroupsList'))
      .flush(page([{ ...group, name: 'Current load' }]));
    await fixture.whenStable();
    expect(fixture.componentInstance.groups()?.[0]?.name).toBe('Current load');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('retains a concurrently protected group and reports its server conflict', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminVehicleGroupsList')).flush(page());
    await fixture.whenStable();
    const deleting = fixture.componentInstance.run({ action: 'delete', ids: [group.id] });
    await fixture.componentInstance.run({ action: 'delete', ids: [group.id] });
    http
      .expectOne((request) => operation(request, 'AdminDeleteVehicleGroup'))
      .flush({
        errors: [
          {
            message: 'Vehicle group still contains vehicles; move them first.',
            extensions: { code: 'CONFLICT' },
          },
        ],
      });
    await deleting;
    expect(fixture.componentInstance.groups()).toHaveLength(1);
    expect(notice).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        sticky: true,
      }),
    );
    expect(notice.mock.calls.at(-1)?.[0].summary).toContain('move them first');
    expect(fixture.componentInstance.acting()).toBe(false);
  });

  it('removes only a successful group then refreshes the server-owned list', async () => {
    const fixture = await mount();
    http.expectOne((request) => operation(request, 'AdminVehicleGroupsList')).flush(page());
    await fixture.whenStable();
    const deleting = fixture.componentInstance.run({ action: 'delete', ids: [group.id] });
    http
      .expectOne((request) => operation(request, 'AdminDeleteVehicleGroup'))
      .flush({ data: { deleteFleetVehicleGroup: group } });
    await deleting;
    expect(fixture.componentInstance.groups()).toEqual([]);
    http.expectOne((request) => operation(request, 'AdminVehicleGroupsList')).flush(page([]));
    await fixture.whenStable();
    expect(notice).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Groups deleted: 1.' }),
    );
  });

  it('ignores a submitted deletion result after moving to another Branch', async () => {
    const old = await mount();
    http.expectOne((request) => operation(request, 'AdminVehicleGroupsList')).flush(page());
    await old.whenStable();
    const deleting = old.componentInstance.run({ action: 'delete', ids: [group.id] });
    const write = http.expectOne((request) => operation(request, 'AdminDeleteVehicleGroup'));
    old.destroy();
    const current = await mount(branchB);
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroupsList', branchB))
      .flush(page([{ ...group, branchId: branchB, name: 'Other Branch' }]));
    await current.whenStable();
    expect(write.cancelled).toBe(false);
    write.flush({ data: { deleteFleetVehicleGroup: group } });
    await deleting;
    expect(current.componentInstance.groups()?.[0]?.name).toBe('Other Branch');
    expect(notice).not.toHaveBeenCalled();
    http.expectNone('/graphql');
  });
});
