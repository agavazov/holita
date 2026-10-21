import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { AdminDeviceConfigurationOperationFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DeviceConfigurationPage } from './device-configuration-page';
import { DeviceConfigurationView } from './device-configuration-view';
import { DeviceParameterEditor } from './device-parameter-editor';

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

function saved(
  status: AdminDeviceConfigurationOperationFragment['status'] = 'WAITING',
  id = '80000000-0000-4000-8000-000000000001',
): AdminDeviceConfigurationOperationFragment & { readonly __typename: 'FleetDeviceOperation' } {
  return {
    __typename: 'FleetDeviceOperation',
    id,
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
    status,
    requestedAt: '2026-10-20T10:00:00.000Z',
    dispatchedAt: '2026-10-20T10:00:01.000Z',
    completedAt: status === 'COMPLETE' ? '2026-10-20T10:03:00.000Z' : null,
    nextCheckAt: '2026-10-20T10:00:10.000Z',
    deadlineAt: '2026-10-20T10:15:00.000Z',
    errorCode: null,
    queueIds: ['1234'],
    observationCount: status === 'COMPLETE' ? 1 : 0,
    coverageComplete: status === 'COMPLETE',
    configuration:
      status === 'COMPLETE'
        ? {
            configurationId: '1001',
            parameters: [
              { parameterId: 65000, intervalSeconds: 0, definitionHex: 'FDE8' + '00'.repeat(20) },
            ],
          }
        : null,
  };
}

function pageResponse(
  operations: readonly AdminDeviceConfigurationOperationFragment[] = [],
  enabled = true,
) {
  return {
    data: {
      fleetDevice: { id: deviceId, imei: '001234567890123', vehicleId: null, vehicle: null },
      fleetDeviceOperationsEnabled: enabled,
      fleetDeviceConfigurationWritesEnabled: enabled,
      fleetDeviceParameterPresets: [],
      fleetDeviceOperations: operations,
      fleetDeviceConfigurationSnapshot:
        operations.find((operation) => operation.configuration) ?? null,
    },
  };
}

function snapshot(id = deviceId, branchId = branchA) {
  const current = {
    paramMap: convertToParamMap({ recordId: id, branchId }),
    queryParamMap: convertToParamMap({}),
  };
  return { ...current, pathFromRoot: [current] };
}

function pageText(fixture: ComponentFixture<DeviceConfigurationPage>): string {
  const element: unknown = fixture.nativeElement;
  if (!(element instanceof HTMLElement)) {
    throw new Error('Missing device configuration page element.');
  }
  return element.textContent;
}

describe('Background device configuration page', () => {
  let http: HttpTestingController;
  const route = { snapshot: snapshot() };
  const fixtures: ComponentFixture<DeviceConfigurationPage>[] = [];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        { provide: ActivatedRoute, useValue: route },
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
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  async function mount(branchId = branchA, id = deviceId) {
    route.snapshot = snapshot(id, branchId);
    const fixture = TestBed.createComponent(DeviceConfigurationPage);
    fixture.componentRef.setInput('branch', { id: branchId, name: 'Test fleet' });
    fixture.componentRef.setInput('language', 'en');
    fixtures.push(fixture);
    await fixture.whenStable();
    return fixture;
  }
  function targets() {
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationTargets'))
      .flush({
        data: {
          karmaCars: [{ id: '41', deviceId: input.expectedKarmaDeviceId, carNumber: 'TRUCK 41' }],
        },
      });
  }

  it('loads persisted requests and results on every remount without issuing another device command', async () => {
    const waiting = saved();
    const complete = saved('COMPLETE', '80000000-0000-4000-8000-000000000002');
    for (let index = 0; index < 2; index++) {
      const fixture = await mount();
      http
        .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
        .flush(pageResponse([waiting, complete]));
      await fixture.whenStable();
      targets();
      await fixture.whenStable();
      expect(fixture.componentInstance.operations()).toEqual([waiting, complete]);
      expect(pageText(fixture)).toContain('Waiting for device');
      expect(pageText(fixture)).toContain('FDE8' + '00'.repeat(20));
      http.expectNone((request) => operation(request, 'AdminRequestDeviceConfigurationRead'));
      fixture.destroy();
    }
  });

  it('polls the saved operation until the backend returns a complete result', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([saved()]));
    await fixture.whenStable();
    targets();
    const poll = await vi.waitFor(
      () => http.expectOne((request) => operation(request, 'AdminDeviceConfigurationPage')),
      { timeout: 6500 },
    );
    poll.flush(pageResponse([saved('COMPLETE')]));
    await fixture.whenStable();
    expect(pageText(fixture)).toContain('Configuration confirmed');
    expect(pageText(fixture)).toContain('FDE8' + '00'.repeat(20));
  }, 10000);

  it('saves one request immediately and suppresses obsolete completion after navigation to another Branch', async () => {
    const notice = vi.spyOn(TestBed.inject(MessageService), 'add');
    const previous = await mount();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse());
    await previous.whenStable();
    targets();
    await previous.whenStable();
    const submission = previous.componentInstance.requestRead(input);
    void previous.componentInstance.requestRead(input);
    const write = http.expectOne((request) =>
      operation(request, 'AdminRequestDeviceConfigurationRead'),
    );
    expect(previous.componentInstance.requesting()).toBe(true);
    expect(previous.componentInstance.canLeave()).toBe(false);
    previous.destroy();
    expect(write.cancelled).toBe(false);
    const current = await mount(branchB);
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([], false));
    await current.whenStable();
    write.flush({ data: { requestFleetDeviceConfigurationRead: saved('QUEUED') } });
    await submission;
    expect(current.componentInstance.operations()).toEqual([]);
    expect(notice).not.toHaveBeenCalled();
    http.expectNone((request) => operation(request, 'AdminDeviceConfigurationPage'));
  });

  it('reconciles a failed browser response by refreshing saved requests before another submission', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse());
    await fixture.whenStable();
    targets();
    await fixture.whenStable();
    const submission = fixture.componentInstance.requestRead(input);
    expect(fixture.componentInstance.canLeave()).toBe(false);
    http
      .expectOne((request) => operation(request, 'AdminRequestDeviceConfigurationRead'))
      .flush('lost response', { status: 503, statusText: 'Unavailable' });
    await submission;
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([saved('UNKNOWN')]));
    await fixture.whenStable();
    expect(fixture.componentInstance.operations()[0]?.status).toBe('UNKNOWN');
    expect(fixture.componentInstance.canLeave()).toBe(true);
    await fixture.componentInstance.requestRead(input);
    http.expectNone((request) => operation(request, 'AdminRequestDeviceConfigurationRead'));
  });

  it('finishes a page refresh before accepting a read and reloads the persisted request after submission', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse());
    await fixture.whenStable();
    targets();
    await fixture.whenStable();
    fixture.componentInstance.refresh();
    const refresh = http.expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'));
    await fixture.componentInstance.requestRead(input);
    http.expectNone((request) => operation(request, 'AdminRequestDeviceConfigurationRead'));
    refresh.flush(pageResponse());
    await fixture.whenStable();
    const submission = fixture.componentInstance.requestRead(input);
    http
      .expectOne((request) => operation(request, 'AdminRequestDeviceConfigurationRead'))
      .flush({
        data: { requestFleetDeviceConfigurationRead: saved('QUEUED') },
      });
    await submission;
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([saved('QUEUED')]));
    await fixture.whenStable();
    expect(fixture.componentInstance.operations()[0]?.status).toBe('QUEUED');
  });

  it('reloads a changed Karma target after a conflict and requires confirmation before retry', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse());
    await fixture.whenStable();
    targets();
    await fixture.whenStable();
    const view: unknown = fixture.debugElement.query(
      By.directive(DeviceConfigurationView),
    ).componentInstance;
    if (!(view instanceof DeviceConfigurationView)) {
      throw new Error('Missing device configuration view.');
    }
    view.form.controls.carId.setValue(input.karmaCarId);
    await fixture.whenStable();
    view.form.controls.confirmed.setValue(true);
    const submission = fixture.componentInstance.requestRead(input);
    http
      .expectOne((request) => operation(request, 'AdminRequestDeviceConfigurationRead'))
      .flush({
        errors: [
          {
            message: 'The Karma device target has changed.',
            extensions: { code: 'CONFLICT' },
          },
        ],
      });
    await submission;
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse());
    const replacement = { ...input, expectedKarmaDeviceId: 'replacement-device' };
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationTargets'))
      .flush({
        data: {
          karmaCars: [
            {
              id: input.karmaCarId,
              deviceId: replacement.expectedKarmaDeviceId,
              carNumber: 'TRUCK 41',
            },
          ],
        },
      });
    await fixture.whenStable();
    expect(fixture.componentInstance.targets()[0]?.deviceId).toBe(
      replacement.expectedKarmaDeviceId,
    );
    expect(view.form.controls.confirmed.value).toBe(false);
    view.submit();
    http.expectNone((request) => operation(request, 'AdminRequestDeviceConfigurationRead'));
    view.form.controls.confirmed.setValue(true);
    view.submit();
    const retry = http.expectOne((request) =>
      operation(request, 'AdminRequestDeviceConfigurationRead'),
    );
    expect(retry.request.body).toMatchObject({ variables: { input: replacement } });
    const queued = { ...saved('QUEUED'), karmaDeviceId: replacement.expectedKarmaDeviceId };
    retry.flush({
      data: { requestFleetDeviceConfigurationRead: queued },
    });
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([queued]));
    await fixture.whenStable();
  });

  it('keeps an earlier confirmed snapshot when a newer read has failed', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(
        pageResponse(
          [saved('FAILED'), saved('COMPLETE', '80000000-0000-4000-8000-000000000002')],
          false,
        ),
      );
    await fixture.whenStable();
    expect(pageText(fixture)).toContain('Operation failed');
    expect(pageText(fixture)).toContain('FDE8' + '00'.repeat(20));
    expect(pageText(fixture)).toContain('Background device reads are disabled');
    http.expectNone((request) => operation(request, 'AdminDeviceConfigurationTargets'));
  });

  it('does not request data for an invalid device ID and handles a scoped missing record', async () => {
    const invalid = await mount(branchA, 'invalid');
    expect(invalid.componentInstance.state()).toBe('invalid-id');
    http.expectNone('/graphql');
    invalid.destroy();
    const missing = await mount();
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush({
        errors: [{ message: 'Device not found.', extensions: { code: 'NOT_FOUND' } }],
      });
    await missing.whenStable();
    expect(missing.componentInstance.state()).toBe('not-found');
    http.expectNone((request) => operation(request, 'AdminDeviceConfigurationTargets'));
  });

  it('recovers a persisted uncertain parameter update and keeps its last complete baseline after remount', async () => {
    const complete = saved('COMPLETE');
    const write: AdminDeviceConfigurationOperationFragment = {
      ...saved('UNKNOWN', '80000000-0000-4000-8000-000000000003'),
      kind: 'UPDATE_INTERVAL',
      phase: 'VERIFY_PARAMETERS',
      baselineOperationId: complete.id,
      parameterId: 65000,
      previousIntervalSeconds: 0,
      intervalSeconds: 60,
      writeDispatchedAt: '2026-10-20T10:01:00.000Z',
      writeUncertain: true,
    };
    for (let index = 0; index < 2; index++) {
      const fixture = await mount();
      http
        .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
        .flush(pageResponse([write, complete]));
      await fixture.whenStable();
      targets();
      await fixture.whenStable();
      expect(pageText(fixture)).toContain('Update interval');
      expect(pageText(fixture)).toContain('Verifying complete configuration');
      expect(pageText(fixture)).toContain('does not automatically resend an uncertain write');
      expect(pageText(fixture)).toContain('FDE8' + '00'.repeat(20));
      http.expectNone((request) => operation(request, 'AdminRequestDeviceParameterIntervalUpdate'));
      fixture.destroy();
    }
  });

  it('blocks another submission and retries reconciliation when both the save response and refresh fail', async () => {
    const fixture = await mount();
    const baseline = saved('COMPLETE');
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([baseline]));
    await fixture.whenStable();
    targets();
    await fixture.whenStable();
    const view: unknown = fixture.debugElement.query(
      By.directive(DeviceConfigurationView),
    ).componentInstance;
    if (!(view instanceof DeviceConfigurationView)) {
      throw new Error('Missing device configuration view.');
    }
    view.form.controls.carId.setValue(input.karmaCarId);
    await fixture.whenStable();
    const editor: unknown = fixture.debugElement.query(
      By.directive(DeviceParameterEditor),
    ).componentInstance;
    if (!(editor instanceof DeviceParameterEditor)) {
      throw new Error('Missing parameter editor.');
    }
    editor.form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 60 });
    editor.form.controls.confirmed.setValue(true);
    editor.form.markAsDirty();
    const change = {
      ...input,
      baselineOperationId: baseline.id,
      parameterId: 65000,
      intervalSeconds: 60,
    };
    const submission = fixture.componentInstance.requestIntervalUpdate(change);
    http
      .expectOne((request) => operation(request, 'AdminRequestDeviceParameterIntervalUpdate'))
      .flush('Lost response', { status: 503, statusText: 'Unavailable' });
    await submission;
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush('Refresh unavailable', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(pageText(fixture)).toContain('Checking whether the request was saved.');
    expect(editor.form.controls.intervalSeconds.disabled).toBe(true);
    expect(editor.form.controls.intervalSeconds.value).toBe(60);
    expect(editor.form.dirty).toBe(true);
    const blockedWrite = fixture.componentInstance.requestIntervalUpdate(change);
    const blockedRead = fixture.componentInstance.requestRead(input);
    http.expectNone((request) => operation(request, 'AdminRequestDeviceParameterIntervalUpdate'));
    http.expectNone((request) => operation(request, 'AdminRequestDeviceConfigurationRead'));
    await Promise.all([blockedWrite, blockedRead]);
    const refreshButton = fixture.debugElement.queryAll(By.css('button')).find((item) => {
      const element: unknown = item.nativeElement;
      return (
        element instanceof HTMLButtonElement &&
        element.textContent.trim() === 'Refresh saved results'
      );
    });
    const element: unknown = refreshButton?.nativeElement;
    expect(element instanceof HTMLButtonElement && !element.disabled).toBe(true);

    // No pending operation was known before the lost response; reconciliation still polls.
    const poll = await vi.waitFor(
      () => http.expectOne((request) => operation(request, 'AdminDeviceConfigurationPage')),
      { timeout: 6500 },
    );
    const uncertain: AdminDeviceConfigurationOperationFragment = {
      ...saved('UNKNOWN', '80000000-0000-4000-8000-000000000003'),
      kind: 'UPDATE_INTERVAL',
      phase: 'VERIFY_PARAMETERS',
      baselineOperationId: baseline.id,
      parameterId: 65000,
      previousIntervalSeconds: 0,
      intervalSeconds: 60,
      writeUncertain: true,
    };
    poll.flush(pageResponse([uncertain, baseline]));
    await fixture.whenStable();
    expect(pageText(fixture)).not.toContain('Checking whether the request was saved.');
    expect(pageText(fixture)).toContain('Submission uncertain; checking for response');
    expect(editor.form.controls.intervalSeconds.disabled).toBe(true);
    http.expectNone((request) => operation(request, 'AdminRequestDeviceParameterIntervalUpdate'));
  }, 10000);

  it.each(['change', 'discard'] as const)(
    'retains a failed parameter draft without resending and clears obsolete errors on %s',
    async (action) => {
      const fixture = await mount();
      const baseline = saved('COMPLETE');
      http
        .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
        .flush(pageResponse([baseline]));
      await fixture.whenStable();
      targets();
      await fixture.whenStable();
      const view: unknown = fixture.debugElement.query(
        By.directive(DeviceConfigurationView),
      ).componentInstance;
      if (!(view instanceof DeviceConfigurationView)) {
        throw new Error('Missing device configuration view.');
      }
      view.form.controls.carId.setValue(input.karmaCarId);
      await fixture.whenStable();
      const editor: unknown = fixture.debugElement.query(
        By.directive(DeviceParameterEditor),
      ).componentInstance;
      if (!(editor instanceof DeviceParameterEditor)) {
        throw new Error('Missing parameter editor.');
      }
      editor.form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 60 });
      editor.form.controls.confirmed.setValue(true);
      editor.form.markAsDirty();
      const change = {
        ...input,
        baselineOperationId: baseline.id,
        parameterId: 65000,
        intervalSeconds: 60,
      };
      const submission = fixture.componentInstance.requestIntervalUpdate(change);
      http
        .expectOne((request) => operation(request, 'AdminRequestDeviceParameterIntervalUpdate'))
        .flush('Unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'x-request-id': 'parameter-write-failure' },
        });
      await submission;
      http
        .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
        .flush(pageResponse([baseline]));
      await fixture.whenStable();
      expect(pageText(fixture)).toContain(
        'The parameter change could not be confirmed as saved. Check refreshed saved operations before submitting again.',
      );
      expect(editor.form.controls.intervalSeconds.value).toBe(60);
      expect(editor.form.dirty).toBe(true);
      http.expectNone((request) => operation(request, 'AdminRequestDeviceParameterIntervalUpdate'));
      if (action === 'change') {
        editor.form.controls.intervalSeconds.setValue(90);
      } else {
        const button = fixture.debugElement.queryAll(By.css('button')).find((item) => {
          const element: unknown = item.nativeElement;
          return (
            element instanceof HTMLButtonElement && element.textContent.trim() === 'Discard draft'
          );
        });
        if (!button) {
          throw new Error('Missing discard button.');
        }
        button.triggerEventHandler('click');
      }
      await fixture.whenStable();
      expect(pageText(fixture)).not.toContain(
        'The parameter change could not be confirmed as saved.',
      );
      expect(editor.form.controls.intervalSeconds.value).toBe(action === 'change' ? 90 : null);
      http.expectNone((request) => operation(request, 'AdminRequestDeviceParameterIntervalUpdate'));
    },
  );

  it('lets an accepted parameter addition settle in its initiating scope without notifying the next Branch', async () => {
    const notice = vi.spyOn(TestBed.inject(MessageService), 'add');
    const previous = await mount();
    const complete = saved('COMPLETE');
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([complete]));
    await previous.whenStable();
    targets();
    await previous.whenStable();
    const change = {
      ...input,
      baselineOperationId: complete.id,
      catalogId: 'catalog-956',
      parameterId: 1001,
      intervalSeconds: 60,
    };
    const submission = previous.componentInstance.requestAddition(change);
    const request = http.expectOne((request) =>
      operation(request, 'AdminRequestDeviceParameterAddition'),
    );
    expect(request.request.body).toMatchObject({ variables: { input: change } });
    previous.destroy();
    expect(request.cancelled).toBe(false);
    const next = await mount(branchB);
    http
      .expectOne((request) => operation(request, 'AdminDeviceConfigurationPage'))
      .flush(pageResponse([], false));
    request.flush({
      data: {
        requestFleetDeviceParameterAddition: {
          ...saved('QUEUED', '80000000-0000-4000-8000-000000000004'),
          kind: 'ADD_PARAMETER',
          phase: 'READ_PROFILE',
          baselineOperationId: complete.id,
          parameterId: 1001,
          intervalSeconds: 60,
          catalogId: 'catalog-956',
        },
      },
    });
    await submission;
    await next.whenStable();
    expect(request.request.headers.get('x-branch-id')).toBe(branchA);
    expect(notice).not.toHaveBeenCalled();
    expect(next.componentInstance.operations()).toEqual([]);
    http.expectNone((request) => operation(request, 'AdminDeviceConfigurationPage'));
  });
});
