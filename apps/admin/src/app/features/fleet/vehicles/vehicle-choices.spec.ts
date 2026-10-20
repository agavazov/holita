import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type {
  AdminVehicleDriversQuery,
  AdminVehicleGroupsQuery,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { VehicleChoices } from './vehicle-choices';
import { VehiclesApi } from './vehicles-api';

const branchId = '10000000-0000-4000-8000-000000000001';

@Component({
  selector: 'holita-vehicle-choices-test-host',
  providers: [VehiclesApi, VehicleChoices],
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ChoicesHost {
  readonly choices = inject(VehicleChoices);
  constructor() {
    inject(VehiclesApi).initialize(branchId, 'en');
  }
}

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function groups(
  offset: number,
  count: number,
): AdminVehicleGroupsQuery['fleetVehicleGroups']['items'] {
  return Array.from({ length: count }, (_, index) => ({
    id: `30000000-0000-4000-8000-${String(offset + index + 1).padStart(12, '0')}`,
    name: `Group ${String(offset + index + 1)}`,
  }));
}

function drivers(offset: number, count: number): AdminVehicleDriversQuery['fleetDrivers']['items'] {
  return Array.from({ length: count }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(offset + index + 1).padStart(12, '0')}`,
    firstName: `Driver ${String(offset + index + 1)}`,
    lastName: 'Example',
    status: index % 3 === 0 ? 'ACTIVE' : index % 3 === 1 ? 'ON_LEAVE' : 'INACTIVE',
  }));
}

describe('Vehicle assignment choices', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ChoicesHost>;
  let choices: VehicleChoices;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: {
        id: '01000000-0000-4000-8000-000000000001',
        name: 'Tenant A',
      },
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChoicesHost);
    choices = fixture.componentInstance.choices;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify({ ignoreCancelled: true });
  });

  it('loads all bounded pages and retains driver statuses after more than 100 choices', async () => {
    choices.load();
    const firstGroups = http.expectOne((request) => operation(request, 'AdminVehicleGroups'));
    const firstDrivers = http.expectOne((request) => operation(request, 'AdminVehicleDrivers'));
    for (const read of [firstGroups, firstDrivers]) {
      expect(read.request.body).toMatchObject({ variables: { offset: 0, limit: 100 } });
      expect(read.request.headers.get('x-branch-id')).toBe(branchId);
      expect(read.request.headers.get('Accept-Language')).toBe('en');
      expect(read.request.headers.get('authorization')).toBe('Bearer test-token');
    }
    firstGroups.flush({
      data: { fleetVehicleGroups: { items: groups(0, 100), offset: 0, limit: 100, total: 101 } },
    });
    firstDrivers.flush({
      data: { fleetDrivers: { items: drivers(0, 100), offset: 0, limit: 100, total: 102 } },
    });
    const moreGroups = await vi.waitFor(() =>
      http.expectOne((request) => operation(request, 'AdminVehicleGroups')),
    );
    const moreDrivers = await vi.waitFor(() =>
      http.expectOne((request) => operation(request, 'AdminVehicleDrivers')),
    );
    expect(moreGroups.request.body).toMatchObject({ variables: { offset: 100, limit: 100 } });
    expect(moreDrivers.request.body).toMatchObject({ variables: { offset: 100, limit: 100 } });
    moreGroups.flush({
      data: { fleetVehicleGroups: { items: groups(100, 1), offset: 100, limit: 100, total: 101 } },
    });
    expect(choices.loading()).toBe(true);
    expect(choices.groups()).toEqual([]);
    moreDrivers.flush({
      data: { fleetDrivers: { items: drivers(100, 2), offset: 100, limit: 100, total: 102 } },
    });
    await vi.waitFor(() => {
      expect(choices.loading()).toBe(false);
    });
    expect(choices.groups()).toHaveLength(101);
    expect(new Set(choices.groups().map((group) => group.id)).size).toBe(101);
    expect(choices.groups().at(-1)?.name).toBe('Group 101');
    expect(choices.drivers()).toHaveLength(102);
    expect(choices.drivers()[2]).toMatchObject({ name: 'Driver 3 Example', status: 'INACTIVE' });
    expect(choices.drivers().at(-1)?.id).toBe('40000000-0000-4000-8000-000000000102');
    expect(choices.error()).toBeNull();
  });

  it('retains complete choices after failure and replaces them after a successful retry', async () => {
    choices.load();
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroups'))
      .flush({
        data: {
          fleetVehicleGroups: { items: groups(0, 1), offset: 0, limit: 100, total: 1 },
        },
      });
    http
      .expectOne((request) => operation(request, 'AdminVehicleDrivers'))
      .flush({
        data: {
          fleetDrivers: { items: drivers(0, 1), offset: 0, limit: 100, total: 1 },
        },
      });
    await vi.waitFor(() => {
      expect(choices.loading()).toBe(false);
    });
    const savedGroups = choices.groups();
    const savedDrivers = choices.drivers();
    choices.load();
    const failed = http.expectOne((request) => operation(request, 'AdminVehicleGroups'));
    const abandoned = http.expectOne((request) => operation(request, 'AdminVehicleDrivers'));
    failed.flush({ errors: [{ message: 'Groups unavailable' }] });
    await vi.waitFor(() => {
      expect(choices.error()).not.toBeNull();
    });
    expect(choices.loading()).toBe(false);
    expect(abandoned.cancelled).toBe(true);
    expect(choices.groups()).toBe(savedGroups);
    expect(choices.drivers()).toBe(savedDrivers);
    choices.load();
    expect(choices.error()).toBeNull();
    const retryGroups = http.expectOne((request) => operation(request, 'AdminVehicleGroups'));
    const retryDrivers = http.expectOne((request) => operation(request, 'AdminVehicleDrivers'));
    expect(retryGroups.request.headers.get('x-request-id')).not.toBe(
      failed.request.headers.get('x-request-id'),
    );
    retryGroups.flush({
      data: { fleetVehicleGroups: { items: groups(10, 1), offset: 0, limit: 100, total: 1 } },
    });
    retryDrivers.flush({
      data: { fleetDrivers: { items: drivers(10, 1), offset: 0, limit: 100, total: 1 } },
    });
    await vi.waitFor(() => {
      expect(choices.loading()).toBe(false);
    });
    expect(choices.groups()[0]?.name).toBe('Group 11');
    expect(choices.drivers()[0]?.name).toBe('Driver 11 Example');
    expect(choices.error()).toBeNull();
  });

  it('cancels replaced lookup reads and cancels the current lookup when its host retires', async () => {
    choices.load();
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroups'))
      .flush({
        data: {
          fleetVehicleGroups: { items: groups(0, 100), offset: 0, limit: 100, total: 101 },
        },
      });
    http
      .expectOne((request) => operation(request, 'AdminVehicleDrivers'))
      .flush({
        data: {
          fleetDrivers: { items: drivers(0, 100), offset: 0, limit: 100, total: 101 },
        },
      });
    const oldGroups = await vi.waitFor(() =>
      http.expectOne((request) => operation(request, 'AdminVehicleGroups')),
    );
    const oldDrivers = await vi.waitFor(() =>
      http.expectOne((request) => operation(request, 'AdminVehicleDrivers')),
    );
    expect(oldGroups.request.body).toMatchObject({ variables: { offset: 100 } });
    expect(oldDrivers.request.body).toMatchObject({ variables: { offset: 100 } });
    choices.load();
    await vi.waitFor(() => {
      expect(oldGroups.cancelled).toBe(true);
      expect(oldDrivers.cancelled).toBe(true);
    });
    const currentGroups = http.expectOne((request) => operation(request, 'AdminVehicleGroups'));
    const currentDrivers = http.expectOne((request) => operation(request, 'AdminVehicleDrivers'));
    fixture.destroy();
    expect(currentGroups.cancelled).toBe(true);
    expect(currentDrivers.cancelled).toBe(true);
    expect(choices.groups()).toEqual([]);
    expect(choices.drivers()).toEqual([]);
  });
});
