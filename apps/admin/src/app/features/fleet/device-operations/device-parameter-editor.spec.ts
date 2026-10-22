import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type {
  AdminRequestDeviceParameterAdditionMutationVariables,
  AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import type { DeviceConfigurationOperation } from './device-configuration-view';
import { DeviceParameterEditor } from './device-parameter-editor';

const deviceId = '60000000-0000-4000-8000-000000000001';
const baseline: DeviceConfigurationOperation = {
  id: '80000000-0000-4000-8000-000000000001',
  deviceId,
  deviceImei: '001234567890123',
  karmaCarId: '41',
  karmaDeviceId: 'opaque-device-41',
  kind: 'READ_CONFIGURATION',
  phase: 'READ_PARAMETERS',
  status: 'COMPLETE',
  requestedAt: '2026-10-20T10:00:00.000Z',
  dispatchedAt: null,
  completedAt: '2026-10-20T10:03:00.000Z',
  nextCheckAt: '2026-10-20T10:03:00.000Z',
  deadlineAt: '2026-10-20T10:15:00.000Z',
  errorCode: null,
  queueIds: [],
  observationCount: 1,
  coverageComplete: true,
  baselineOperationId: null,
  parameterId: null,
  intervalSeconds: null,
  previousIntervalSeconds: null,
  catalogId: null,
  profileId: null,
  writeDispatchedAt: null,
  writeUncertain: false,
  configuration: {
    configurationId: '1001',
    parameters: [
      { parameterId: 65000, intervalSeconds: 30, definitionHex: 'FDE8' + 'AB'.repeat(18) + '001E' },
      { parameterId: 65001, intervalSeconds: 60, definitionHex: 'FDE9' + 'AB'.repeat(18) + '003C' },
    ],
  },
};
const target = { id: '41', deviceId: 'opaque-device-41', carNumber: 'Truck 41' };
const preset = JSON.stringify(['catalog-956', 1001]);

describe('Device parameter editor', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('en') }],
    }),
  );

  it('submits exactly the confirmed parameter change for the captured baseline and target, and requires a new confirmation after any change', async () => {
    const fixture = TestBed.createComponent(DeviceParameterEditor);
    fixture.componentRef.setInput('deviceId', deviceId);
    fixture.componentRef.setInput('enabled', true);
    fixture.componentRef.setInput('target', target);
    fixture.componentRef.setInput('latestBaseline', baseline);
    fixture.componentRef.setInput('presets', [
      {
        catalogId: 'catalog-956',
        catalogLabel: 'Monitor 9.56',
        parameterId: 1001,
        name: 'Fixture parameter',
        profileIds: [0],
      },
    ]);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    const updates: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'][] = [];
    const additions: AdminRequestDeviceParameterAdditionMutationVariables['input'][] = [];
    fixture.componentInstance.intervalUpdate.subscribe((value) => updates.push(value));
    fixture.componentInstance.addition.subscribe((value) => additions.push(value));
    const submit = () => {
      fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    };
    const confirmedTarget = {
      deviceId,
      karmaCarId: '41',
      expectedKarmaDeviceId: 'opaque-device-41',
      baselineOperationId: baseline.id,
    };

    const edits = [
      {
        edit: 'value',
        apply: () => {
          form.controls.intervalSeconds.setValue(90);
        },
      },
      {
        edit: 'parameter',
        apply: () => {
          form.controls.parameterId.setValue(65001);
        },
      },
      {
        edit: 'mode',
        apply: () => {
          form.patchValue({ mode: 'add', presetKey: preset });
        },
      },
    ];
    for (const { edit, apply } of edits) {
      form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 60 });
      form.controls.confirmed.setValue(true);
      apply();
      submit();
      expect(form.controls.confirmed.value, `confirmation after a ${edit} edit`).toBe(false);
    }
    expect([...updates, ...additions], 'unconfirmed edits').toEqual([]);

    form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 60 });
    form.controls.confirmed.setValue(true);
    submit();
    expect(updates, 'confirmed interval update').toEqual([
      { ...confirmedTarget, parameterId: 65000, intervalSeconds: 60 },
    ]);

    form.patchValue({ mode: 'add', presetKey: preset, intervalSeconds: 0 });
    form.controls.confirmed.setValue(true);
    submit();
    expect(additions, 'zero without its separate confirmation').toEqual([]);
    form.controls.zeroConfirmed.setValue(true);
    submit();
    expect(additions, 'confirmed zero addition from the catalog preset').toEqual([
      { ...confirmedTarget, catalogId: 'catalog-956', parameterId: 1001, intervalSeconds: 0 },
    ]);

    const contextChanges = [
      {
        change: 'same-truck device replacement',
        apply: () => {
          fixture.componentRef.setInput('target', { ...target, deviceId: 'replacement-device' });
        },
      },
      {
        change: 'new baseline',
        apply: () => {
          fixture.componentRef.setInput('latestBaseline', { ...baseline, id: 'new-baseline' });
        },
      },
    ];
    for (const { change, apply } of contextChanges) {
      fixture.componentRef.setInput('target', target);
      fixture.componentRef.setInput('latestBaseline', baseline);
      await fixture.whenStable();
      form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 60 });
      form.controls.confirmed.setValue(true);
      apply();
      submit();
      await fixture.whenStable();
      expect(form.controls.confirmed.value, `confirmation after a ${change}`).toBe(false);
      expect(form.disabled, `editor after a ${change}`).toBe(true);
    }
    expect(updates, 'submissions after a target or baseline change').toHaveLength(1);
    expect(additions, 'submissions after a target or baseline change').toHaveLength(1);
    // The case renders several PrimeNG states in jsdom; a loaded host exceeds the 5-second default.
  }, 20_000);
});
