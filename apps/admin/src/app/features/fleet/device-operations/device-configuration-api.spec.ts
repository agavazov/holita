import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DemoSession } from '../../../core/auth/demo-session';
import type { Language } from '../../../i18n/messages';
import { DeviceConfigurationApi } from './device-configuration-api';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const deviceId = '60000000-0000-4000-8000-000000000001';
const input = { deviceId, karmaCarId: '41', expectedKarmaDeviceId: '000123456789012' };

function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function pageResponse(enabled = true) {
  return {
    data: {
      fleetDevice: { id: deviceId, imei: '001234567890123', vehicleId: null, vehicle: null },
      fleetDeviceOperationsEnabled: enabled,
      fleetDeviceConfigurationWritesEnabled: enabled,
      fleetDeviceParameterPresets: [],
      fleetDeviceOperations: [],
      fleetDeviceConfigurationSnapshot: null,
    },
  };
}

describe('Device configuration captured clients', () => {
  let http: HttpTestingController;
  const clients: DeviceConfigurationApi[] = [];
  function mount(branchId = branchA, language: Language = 'en') {
    const api = TestBed.runInInjectionContext(() => new DeviceConfigurationApi());
    api.initialize(branchId, language);
    clients.push(api);
    return api;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'tenant-a',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    clients.splice(0).forEach((client) => {
      client.ngOnDestroy();
    });
    http.verify({ ignoreCancelled: true });
  });

  it('uses fresh scoped clients through A → B → A and keeps Karma target reads account-scoped', async () => {
    const results: boolean[] = [];
    for (const [branchId, language, enabled] of [
      [branchA, 'en', true],
      [branchB, 'bg', false],
      [branchA, 'en', false],
    ] as const) {
      const api = mount(branchId, language);
      const read = api.watchPage(deviceId).valueChanges.subscribe((result) => {
        if (result.dataState === 'complete' && !result.loading) {
          results.push(result.data.fleetDeviceOperationsEnabled);
        }
      });
      const request = http.expectOne((request) =>
        operation(request, 'AdminDeviceConfigurationPage'),
      );
      expect(request.request.headers.get('x-branch-id')).toBe(branchId);
      expect(request.request.headers.get('authorization')).toBe('Bearer tenant-a');
      expect(request.request.headers.get('Accept-Language')).toBe(language);
      request.flush(pageResponse(enabled));
      const targets = api.watchTargets().valueChanges.subscribe();
      const targetRead = http.expectOne((request) =>
        operation(request, 'AdminDeviceConfigurationTargets'),
      );
      expect(targetRead.request.headers.has('x-branch-id')).toBe(false);
      expect(targetRead.request.headers.get('authorization')).toBe('Bearer tenant-a');
      expect(targetRead.request.headers.get('Accept-Language')).toBe(language);
      targetRead.flush({ data: { karmaCars: [] } });
      await vi.waitFor(() => {
        expect(results.at(-1)).toBe(enabled);
      });
      read.unsubscribe();
      targets.unsubscribe();
      api.ngOnDestroy();
    }
    expect(results).toEqual([true, false, false]);
  });

  it('lets a submitted read request settle in its captured scope after retirement', async () => {
    const previous = mount();
    const completion = previous.requestRead(input);
    const write = http.expectOne((request) =>
      operation(request, 'AdminRequestDeviceConfigurationRead'),
    );
    expect(write.request.body).toMatchObject({ variables: { input } });
    previous.ngOnDestroy();
    expect(write.cancelled).toBe(false);
    const current = mount(branchB, 'bg');
    const read = current.watchPage(deviceId).valueChanges.subscribe();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse(false));
    write.flush({
      data: {
        requestFleetDeviceConfigurationRead: {
          __typename: 'FleetDeviceOperation',
          id: '80000000-0000-4000-8000-000000000001',
          deviceId,
          deviceImei: '001234567890123',
          karmaCarId: '41',
          karmaDeviceId: input.expectedKarmaDeviceId,
          kind: 'READ_CONFIGURATION',
          phase: 'READ_PARAMETERS',
          baselineOperationId: null,
          parameterId: null,
          intervalSeconds: null,
          previousIntervalSeconds: null,
          catalogId: null,
          profileId: null,
          writeDispatchedAt: null,
          writeUncertain: false,
          status: 'QUEUED',
          requestedAt: '2026-10-20T10:00:00.000Z',
          dispatchedAt: null,
          completedAt: null,
          nextCheckAt: '2026-10-20T10:00:00.000Z',
          deadlineAt: '2026-10-20T10:15:00.000Z',
          queueIds: [],
          observationCount: 0,
          coverageComplete: false,
          errorCode: null,
          configuration: null,
        },
      },
    });
    await expect(completion).resolves.toMatchObject({ status: 'QUEUED' });
    expect(write.request.headers.get('x-branch-id')).toBe(branchA);
    expect(write.request.headers.get('Accept-Language')).toBe('en');
    expect(() => previous.watchPage(deviceId)).toThrow();
    http.expectNone((request) => operation(request, 'AdminDeviceConfigurationPage'));
    read.unsubscribe();
  });
});
