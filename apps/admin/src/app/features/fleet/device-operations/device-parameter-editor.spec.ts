import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
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
    ],
  },
};

describe('Device parameter editor', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('en') }],
    }),
  );

  async function mount() {
    const fixture = TestBed.createComponent(DeviceParameterEditor);
    fixture.componentRef.setInput('deviceId', deviceId);
    fixture.componentRef.setInput('enabled', true);
    fixture.componentRef.setInput('target', {
      id: '41',
      deviceId: 'opaque-device-41',
      carNumber: 'Truck 41',
    });
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
    return fixture;
  }

  it('permits route retirement while submission is pending and still warns before browser unload', async () => {
    const fixture = await mount();
    fixture.componentRef.setInput('submitting', true);
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    expect(fixture.componentInstance.canLeave()).toBe(true);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('edits an unknown existing interval using the captured baseline and preserves its original raw definition', async () => {
    const fixture = await mount();
    const updates: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'][] = [];
    fixture.componentInstance.intervalUpdate.subscribe((value) => updates.push(value));
    const form = fixture.componentInstance.form;
    form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 60 });
    form.controls.confirmed.setValue(true);
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    expect(updates).toEqual([
      {
        deviceId,
        karmaCarId: '41',
        expectedKarmaDeviceId: 'opaque-device-41',
        baselineOperationId: baseline.id,
        parameterId: 65000,
        intervalSeconds: 60,
      },
    ]);
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing editor element.');
    }
    expect(element.textContent).toContain('FDE8' + 'AB'.repeat(18) + '001E');
    form.controls.intervalSeconds.setValue(90);
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    expect(updates).toHaveLength(1);
    expect(form.controls.confirmed.value).toBe(false);
  });

  it('requires separate confirmation for zero and sends an addition from a catalog preset only', async () => {
    const fixture = await mount();
    const additions: AdminRequestDeviceParameterAdditionMutationVariables['input'][] = [];
    fixture.componentInstance.addition.subscribe((value) => additions.push(value));
    const form = fixture.componentInstance.form;
    form.patchValue({ presetKey: JSON.stringify(['catalog-956', 1001]), intervalSeconds: 0 });
    form.controls.confirmed.setValue(true);
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    expect(additions).toEqual([]);
    form.controls.zeroConfirmed.setValue(true);
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    expect(additions).toEqual([
      {
        deviceId,
        karmaCarId: '41',
        expectedKarmaDeviceId: 'opaque-device-41',
        baselineOperationId: baseline.id,
        catalogId: 'catalog-956',
        parameterId: 1001,
        intervalSeconds: 0,
      },
    ]);
  });

  it('keeps a dirty draft on refresh but blocks a changed baseline or same-truck replacement before another confirmation', async () => {
    const fixture = await mount();
    const form = fixture.componentInstance.form;
    form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 60 });
    form.markAsDirty();
    form.controls.confirmed.setValue(true);
    fixture.componentRef.setInput('latestBaseline', { ...baseline });
    await fixture.whenStable();
    expect(form.controls.intervalSeconds.value).toBe(60);
    expect(form.controls.confirmed.value).toBe(true);
    const updates: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'][] = [];
    fixture.componentInstance.intervalUpdate.subscribe((value) => updates.push(value));
    fixture.componentRef.setInput('target', {
      id: '41',
      deviceId: 'replacement-device',
      carNumber: 'Truck 41',
    });
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    expect(updates).toEqual([]);
    await fixture.whenStable();
    expect(form.controls.confirmed.value).toBe(false);
    expect(form.controls.intervalSeconds.value).toBe(60);
    expect(form.disabled).toBe(true);
    fixture.componentRef.setInput('target', {
      id: '41',
      deviceId: 'opaque-device-41',
      carNumber: 'Truck 41',
    });
    fixture.componentRef.setInput('latestBaseline', { ...baseline, id: 'new-baseline' });
    await fixture.whenStable();
    expect(form.disabled).toBe(true);
    expect(form.controls.intervalSeconds.value).toBe(60);
  });

  it('asks once before leaving a dirty draft and allows navigation after a durable request is accepted', async () => {
    const fixture = await mount();
    fixture.componentInstance.form.controls.intervalSeconds.setValue(60);
    fixture.componentInstance.form.markAsDirty();
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const confirm = vi.spyOn(confirmation, 'confirm');
    const first = fixture.componentInstance.canLeave();
    expect(fixture.componentInstance.canLeave()).toBe(first);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mock.calls[0]?.[0].reject?.();
    await expect(first).resolves.toBe(false);
    fixture.componentRef.setInput('acceptedOperationId', 'saved-operation');
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();
    expect(fixture.componentInstance.form.pristine).toBe(true);
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });

  it('can discard a pristine interval selection after its captured baseline becomes stale', async () => {
    const fixture = await mount();
    await fixture.componentInstance.editInterval(65000);
    await fixture.whenStable();
    const form = fixture.componentInstance.form;
    expect(form.pristine).toBe(true);
    expect(form.controls.intervalSeconds.value).toBe(30);
    fixture.componentRef.setInput('latestBaseline', { ...baseline, id: 'new-baseline' });
    await fixture.whenStable();
    expect(form.disabled).toBe(true);
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing editor element.');
    }
    const discard = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Discard draft',
    );
    if (!discard) {
      throw new Error('Missing discard draft button.');
    }
    expect(discard.disabled).toBe(false);
    discard.click();
    await fixture.whenStable();
    expect(form.enabled).toBe(true);
    expect(form.controls.parameterId.value).toBeNull();
    expect(form.controls.intervalSeconds.value).toBeNull();
    const updates: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'][] = [];
    fixture.componentInstance.intervalUpdate.subscribe((value) => updates.push(value));
    await fixture.componentInstance.editInterval(65000);
    form.controls.intervalSeconds.setValue(60);
    form.controls.confirmed.setValue(true);
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    expect(updates).toEqual([
      {
        deviceId,
        karmaCarId: '41',
        expectedKarmaDeviceId: 'opaque-device-41',
        baselineOperationId: 'new-baseline',
        parameterId: 65000,
        intervalSeconds: 60,
      },
    ]);
  });

  it.each(['parameter', 'mode'] as const)(
    'revalidates an unchanged interval after changing the %s without dropping its bounds',
    async (change) => {
      const fixture = await mount();
      fixture.componentRef.setInput('latestBaseline', {
        ...baseline,
        configuration: {
          configurationId: '1001',
          parameters: [
            {
              parameterId: 65000,
              intervalSeconds: 30,
              definitionHex: 'FDE8' + 'AB'.repeat(18) + '001E',
            },
            {
              parameterId: 65001,
              intervalSeconds: 60,
              definitionHex: 'FDE9' + 'AB'.repeat(18) + '003C',
            },
          ],
        },
      });
      await fixture.whenStable();
      const updates: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'][] = [];
      const additions: AdminRequestDeviceParameterAdditionMutationVariables['input'][] = [];
      fixture.componentInstance.intervalUpdate.subscribe((value) => updates.push(value));
      fixture.componentInstance.addition.subscribe((value) => additions.push(value));
      const form = fixture.componentInstance.form;
      form.patchValue({ mode: 'interval', parameterId: 65000, intervalSeconds: 30 });
      form.controls.confirmed.setValue(true);
      fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
      expect(form.controls.intervalSeconds.hasError('unchanged')).toBe(true);
      expect(updates).toEqual([]);
      expect(additions).toEqual([]);
      if (change === 'parameter') {
        form.controls.parameterId.setValue(65001);
      } else {
        form.patchValue({ mode: 'add', presetKey: JSON.stringify(['catalog-956', 1001]) });
      }
      expect(form.controls.intervalSeconds.value).toBe(30);
      expect(form.controls.intervalSeconds.errors).toBeNull();
      expect(form.controls.confirmed.value).toBe(false);
      form.controls.confirmed.setValue(true);
      fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
      if (change === 'parameter') {
        expect(updates).toEqual([
          {
            deviceId,
            karmaCarId: '41',
            expectedKarmaDeviceId: 'opaque-device-41',
            baselineOperationId: baseline.id,
            parameterId: 65001,
            intervalSeconds: 30,
          },
        ]);
        expect(additions).toEqual([]);
      } else {
        expect(additions).toEqual([
          {
            deviceId,
            karmaCarId: '41',
            expectedKarmaDeviceId: 'opaque-device-41',
            baselineOperationId: baseline.id,
            catalogId: 'catalog-956',
            parameterId: 1001,
            intervalSeconds: 30,
          },
        ]);
        expect(updates).toEqual([]);
      }
      form.controls.intervalSeconds.setValue(-1);
      form.controls.parameterId.setValue(65000);
      expect(form.controls.intervalSeconds.invalid).toBe(true);
      expect(form.invalid).toBe(true);
    },
  );

  it('keeps a rejected draft and focuses the mapped interval error after the request finishes', async () => {
    const fixture = await mount();
    fixture.componentInstance.form.patchValue({
      mode: 'interval',
      parameterId: 65000,
      intervalSeconds: 60,
    });
    fixture.componentInstance.form.markAsDirty();
    fixture.componentRef.setInput('busy', true);
    fixture.componentRef.setInput('serverFieldErrors', {
      intervalSeconds: 'Interval rejected by the server.',
    });
    fixture.componentRef.setInput('requestError', 'The change could not be saved.');
    await fixture.whenStable();
    fixture.componentRef.setInput('busy', false);
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('parameter-intervalSeconds');
    expect(fixture.componentInstance.form.controls.intervalSeconds.value).toBe(60);
    expect(fixture.componentInstance.form.dirty).toBe(true);
  });
});
