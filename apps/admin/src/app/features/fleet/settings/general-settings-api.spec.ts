import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import { filter, firstValueFrom } from 'rxjs';
import { DemoSession } from '../../../core/auth/demo-session';
import { GeneralSettingsApi } from './general-settings-api';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const settings = {
  __typename: 'FleetSettings',
  timeZone: 'Europe/Sofia',
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
} as const;
const input = {
  timeZone: 'Europe/Sofia',
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 14,
  notReportingHours: 48,
  speedLimitKph: 90,
} as const;

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

describe('GeneralSettingsApi captured clients', () => {
  let http: HttpTestingController;
  const clients: GeneralSettingsApi[] = [];
  function mount(branchId = branchA) {
    const api = TestBed.runInInjectionContext(() => new GeneralSettingsApi());
    api.initialize(branchId, 'bg');
    clients.push(api);
    return api;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    clients.splice(0).forEach((api) => {
      api.ngOnDestroy();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('isolates simultaneous preferences reads and refreshes the same captured scope over the network', async () => {
    const a = mount();
    const b = mount(branchB);
    const readA = firstValueFrom(
      a.watchPreferences().valueChanges.pipe(filter((result) => !result.loading)),
    );
    const readB = firstValueFrom(
      b.watchPreferences().valueChanges.pipe(filter((result) => !result.loading)),
    );
    const requestA = http.expectOne((request) => operation(request, 'AdminFleetPreferences'));
    expect(requestA.request.headers.get('Accept-Language')).toBe('bg');
    requestA.flush({ data: { fleetSettings: settings } });
    http
      .expectOne((request) => operation(request, 'AdminFleetPreferences', branchB))
      .flush({ data: { fleetSettings: { ...settings, lowFuelPct: 20 } } });
    expect((await readA).data?.fleetSettings?.lowFuelPct).toBe(12);
    expect((await readB).data?.fleetSettings?.lowFuelPct).toBe(20);
    const again = firstValueFrom(
      a.watchPreferences().valueChanges.pipe(filter((result) => !result.loading)),
    );
    http
      .expectOne((request) => operation(request, 'AdminFleetPreferences'))
      .flush({ data: { fleetSettings: { ...settings, lowFuelPct: 13 } } });
    expect((await again).data?.fleetSettings?.lowFuelPct).toBe(13);
  });

  it('lets both submitted service writes settle in their original scope before retiring its client', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const api = mount();
    const save = api.update({ input });
    const rename = api.renameBranch({ id: branchA, name: 'Renamed' });
    const fleet = http.expectOne((request) => operation(request, 'AdminUpdateFleetSettings'));
    const core = http.expectOne((request) => operation(request, 'AdminUpdateBranchName'));
    expect(core.request.body).toMatchObject({ variables: { id: branchA, name: 'Renamed' } });
    api.ngOnDestroy();
    TestBed.inject(DemoSession).logout();
    expect(stop).not.toHaveBeenCalled();
    fleet.flush({ data: { updateFleetSettings: { ...settings, lowFuelPct: 14 } } });
    await save;
    expect(stop).not.toHaveBeenCalled();
    core.flush({
      data: { updateBranchName: { __typename: 'Branch', id: branchA, name: 'Renamed' } },
    });
    expect((await rename).name).toBe('Renamed');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(() => api.watchPreferences()).toThrow('active General settings');
  });

  it('preserves a rejected rename and allows a new attempt without reporting success', async () => {
    const api = mount();
    const failed = expect(api.renameBranch({ id: branchA, name: 'Rejected' })).rejects.toThrow(
      'Rejected name.',
    );
    http
      .expectOne((request) => operation(request, 'AdminUpdateBranchName'))
      .flush({
        errors: [
          {
            message: 'Rejected name.',
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldErrors: [{ path: 'name', message: 'Rejected name.' }],
            },
          },
        ],
      });
    await failed;
    const retry = api.renameBranch({ id: branchA, name: 'Accepted' });
    http
      .expectOne((request) => operation(request, 'AdminUpdateBranchName'))
      .flush({
        data: { updateBranchName: { __typename: 'Branch', id: branchA, name: 'Accepted' } },
      });
    expect((await retry).name).toBe('Accepted');
  });
});
