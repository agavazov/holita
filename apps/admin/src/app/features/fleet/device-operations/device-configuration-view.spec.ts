import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type { AdminRequestDeviceConfigurationReadMutationVariables } from '../../../../generated/graphql/operations';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import {
  DeviceConfigurationView,
  type DeviceConfigurationOperation,
} from './device-configuration-view';
import { DeviceParameterEditor } from './device-parameter-editor';

const deviceId = '60000000-0000-4000-8000-000000000001';

function snapshot(
  id = '80000000-0000-4000-8000-000000000001',
  intervalSeconds = 0,
): DeviceConfigurationOperation {
  return {
    id,
    deviceId,
    deviceImei: '001234567890123',
    karmaCarId: '41',
    karmaDeviceId: '000123456789012',
    kind: 'READ_CONFIGURATION',
    phase: 'READ_PARAMETERS',
    status: 'COMPLETE',
    baselineOperationId: null,
    parameterId: null,
    intervalSeconds: null,
    previousIntervalSeconds: null,
    catalogId: null,
    profileId: null,
    writeDispatchedAt: null,
    writeUncertain: false,
    requestedAt: '2026-10-20T10:00:00.000Z',
    dispatchedAt: '2026-10-20T10:00:01.000Z',
    completedAt: '2026-10-20T10:03:00.000Z',
    nextCheckAt: '2026-10-20T10:03:00.000Z',
    deadlineAt: '2026-10-20T10:15:00.000Z',
    errorCode: null,
    queueIds: ['1234'],
    observationCount: 2,
    coverageComplete: true,
    configuration: {
      configurationId: '1001',
      parameters: [
        {
          parameterId: 65000,
          intervalSeconds,
          definitionHex:
            'FDE8' + 'AB'.repeat(18) + intervalSeconds.toString(16).padStart(4, '0').toUpperCase(),
        },
      ],
    },
  };
}

describe('Device configuration target selection', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
  });

  async function mount() {
    const fixture = TestBed.createComponent(DeviceConfigurationView);
    fixture.componentRef.setInput('backLink', ['/en/fleet/devices']);
    fixture.componentRef.setInput('state', 'ready');
    fixture.componentRef.setInput('device', {
      id: deviceId,
      imei: '001234567890123',
      vehicleId: null,
      vehicle: null,
    });
    fixture.componentRef.setInput('enabled', true);
    fixture.componentRef.setInput('targetsState', 'ready');
    fixture.componentRef.setInput('targets', [
      { id: '41', carNumber: 'TRUCK 41', deviceId: '000123456789012' },
      { id: '42', carNumber: 'TRUCK 42', deviceId: 'opaque-device-42' },
    ]);
    await fixture.whenStable();
    return fixture;
  }

  it('requires an explicit target and confirmation and submits opaque device identity unchanged', async () => {
    const fixture = await mount();
    const requests: AdminRequestDeviceConfigurationReadMutationVariables['input'][] = [];
    fixture.componentInstance.requestRead.subscribe((input) => requests.push(input));
    fixture.componentInstance.submit();
    expect(requests).toEqual([]);
    fixture.componentInstance.form.controls.carId.setValue('42');
    await fixture.whenStable();
    fixture.componentInstance.submit();
    expect(requests).toEqual([]);
    fixture.componentInstance.form.controls.confirmed.setValue(true);
    fixture.componentInstance.submit();
    expect(requests).toEqual([
      { deviceId, karmaCarId: '42', expectedKarmaDeviceId: 'opaque-device-42' },
    ]);
  });

  it('requires confirmation again when the selected truck changes', async () => {
    const fixture = await mount();
    fixture.componentInstance.form.controls.carId.setValue('41');
    await fixture.whenStable();
    fixture.componentInstance.form.controls.confirmed.setValue(true);
    fixture.componentInstance.form.controls.carId.setValue('42');
    await fixture.whenStable();
    expect(fixture.componentInstance.form.controls.confirmed.value).toBe(false);
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('retires confirmation when a refreshed truck points to a different device', async () => {
    const fixture = await mount();
    fixture.componentInstance.form.controls.carId.setValue('41');
    await fixture.whenStable();
    fixture.componentInstance.form.controls.confirmed.setValue(true);
    const requests: AdminRequestDeviceConfigurationReadMutationVariables['input'][] = [];
    fixture.componentInstance.requestRead.subscribe((input) => requests.push(input));
    fixture.componentRef.setInput('targets', [
      { id: '41', carNumber: 'TRUCK 41', deviceId: 'replacement-device' },
    ]);
    fixture.componentInstance.submit();
    expect(requests).toEqual([]);
    await fixture.whenStable();
    expect(fixture.componentInstance.form.controls.confirmed.value).toBe(false);
    fixture.componentInstance.form.controls.confirmed.setValue(true);
    fixture.componentInstance.submit();
    expect(requests).toEqual([
      { deviceId, karmaCarId: '41', expectedKarmaDeviceId: 'replacement-device' },
    ]);
  });

  it('disables a new request while a saved operation is still pending', async () => {
    const fixture = await mount();
    fixture.componentInstance.form.controls.carId.setValue('41');
    await fixture.whenStable();
    fixture.componentInstance.form.controls.confirmed.setValue(true);
    fixture.componentRef.setInput('operations', [
      {
        id: '80000000-0000-4000-8000-000000000001',
        deviceId,
        deviceImei: '001234567890123',
        karmaCarId: '41',
        karmaDeviceId: '000123456789012',
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
        status: 'UNKNOWN',
        requestedAt: '2026-10-20T10:00:00.000Z',
        dispatchedAt: null,
        completedAt: null,
        nextCheckAt: '2026-10-20T10:00:10.000Z',
        deadlineAt: '2026-10-20T10:15:00.000Z',
        errorCode: null,
        queueIds: [],
        observationCount: 0,
        coverageComplete: false,
        configuration: null,
      },
    ]);
    await fixture.whenStable();
    const requests: AdminRequestDeviceConfigurationReadMutationVariables['input'][] = [];
    fixture.componentInstance.requestRead.subscribe((input) => requests.push(input));
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.form.disabled).toBe(true);
    expect(requests).toEqual([]);
  });

  it('puts the compact saved parameters before editing and keeps raw definitions available in a disclosure', async () => {
    const fixture = await mount();
    const saved = snapshot();
    fixture.componentRef.setInput('lastSnapshot', saved);
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing configuration view.');
    }
    const result = element.querySelector('#configuration-snapshot-title')?.closest('section');
    const editor = element.querySelector('holita-device-parameter-editor');
    if (!result || !editor) {
      throw new Error('Missing snapshot or parameter editor.');
    }
    expect(result.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(result.querySelectorAll('thead th')).toHaveLength(3);
    expect(result.querySelector('tbody')?.textContent).toContain('65000');
    const details = result.querySelector('details');
    const raw = [...result.querySelectorAll('dd')].find(
      (entry) => entry.textContent === 'FDE8' + 'AB'.repeat(18) + '0000',
    );
    if (!details || !raw) {
      throw new Error('Missing complete definition disclosure.');
    }
    expect(details.open).toBe(false);
    expect(details.contains(raw)).toBe(true);
    details.open = true;
    expect(raw.closest('details')?.open).toBe(true);
  });

  it('distinguishes an older snapshot and restores the latest editable settings with focus', async () => {
    const fixture = await mount();
    const latest = snapshot();
    const older = snapshot('80000000-0000-4000-8000-000000000002', 120);
    fixture.componentRef.setInput('writesEnabled', true);
    fixture.componentRef.setInput('lastSnapshot', latest);
    fixture.componentRef.setInput('operations', [latest, older]);
    fixture.componentInstance.form.controls.carId.setValue('41');
    await fixture.whenStable();
    fixture.componentInstance.showSnapshot(older.id);
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing configuration view.');
    }
    expect(element.querySelector('#configuration-snapshot-title')?.textContent).toContain(
      'Saved parameter snapshot',
    );
    const edit = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit interval 65000"]',
    );
    expect(edit?.disabled).toBe(true);
    const editor: unknown = fixture.debugElement.query(
      By.directive(DeviceParameterEditor),
    ).componentInstance;
    if (!(editor instanceof DeviceParameterEditor)) {
      throw new Error('Missing parameter editor.');
    }
    expect(editor.form.disabled).toBe(true);
    const latestAction = [...element.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Show latest confirmed settings',
    );
    if (!latestAction) {
      throw new Error('Missing latest snapshot action.');
    }
    latestAction.click();
    await fixture.whenStable();
    expect(element.querySelector('#configuration-snapshot-title')?.textContent).toContain(
      'Last confirmed parameter snapshot',
    );
    expect(edit?.disabled).toBe(false);
    expect(editor.form.enabled).toBe(true);
    expect(document.activeElement?.id).toBe('configuration-snapshot-title');
    expect(element.querySelector('tbody td:nth-child(2)')?.textContent.trim()).toBe('0');
  });

  it('keeps uncertainty and errors visible while technical operation metadata is collapsed', async () => {
    const fixture = await mount();
    const failed: DeviceConfigurationOperation = {
      ...snapshot(),
      kind: 'UPDATE_INTERVAL',
      phase: 'VERIFY_PARAMETERS',
      status: 'FAILED',
      parameterId: 65000,
      previousIntervalSeconds: 0,
      intervalSeconds: 60,
      configuration: null,
      writeUncertain: true,
      errorCode: 'VERIFICATION_MISMATCH',
    };
    fixture.componentRef.setInput('operations', [failed]);
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing configuration view.');
    }
    const article = element.querySelector('article');
    const details = article?.querySelector('details');
    const error = [...(article?.querySelectorAll('span') ?? [])].find(
      (entry) => entry.textContent === 'VERIFICATION_MISMATCH',
    );
    if (!article || !details || !error) {
      throw new Error('Missing saved operation details.');
    }
    expect(details.open).toBe(false);
    expect(details.contains(error)).toBe(false);
    expect(error.closest('details')).toBeNull();
    expect(article.querySelector('h3')?.textContent).toContain('Update interval');
    expect(article.textContent).toContain('Verifying complete configuration');
    expect(article.textContent).toContain('does not automatically resend an uncertain write');
  });
});
