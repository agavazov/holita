import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DeviceDrawer, type DeviceForm } from './device-drawer';

describe('Device installation date editor', () => {
  it.each(['en', 'bg'] as const)(
    'edits Branch wall time, preserves milliseconds and clears explicitly in %s',
    async (language) => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: UI_LANGUAGE, useValue: signal(language) },
          {
            provide: FLEET_DISPLAY,
            useValue: signal({ ...defaultFleetDisplay, timeZone: 'America/New_York' }),
          },
        ],
      });
      const fixture = TestBed.createComponent(DeviceDrawer);
      fixture.componentRef.setInput('dataAsOf', '2026-10-18T07:00:00.000Z');
      fixture.componentRef.setInput('value', {
        imei: '000000000000123',
        model: '',
        simIccid: '',
        vehicleId: null,
        notes: '',
        installedAt: '2026-10-18T10:00:15.125+03:00',
      } satisfies DeviceForm);
      const saved: DeviceForm[] = [];
      fixture.componentInstance.save.subscribe((value) => saved.push(value));
      await fixture.whenStable();
      const form = fixture.debugElement
        .query(By.directive(FormGroupDirective))
        .injector.get(FormGroupDirective).form;
      const input = document.getElementById('device-installedAt');
      const element = document.getElementById('device-form');
      if (!(input instanceof HTMLInputElement) || !element) {
        throw new Error('Missing device date input or form.');
      }
      expect(input.type).toBe('datetime-local');
      expect(input.step).toBe('0.001');
      expect(input.value).toBe('2026-10-18T03:00:15.125');
      expect(input.getAttribute('aria-describedby')).toContain('device-installedAt-hint');
      expect(document.getElementById('device-installedAt-hint')?.textContent).toContain(
        'America/New_York',
      );
      const submit = () =>
        element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      const enter = (value: string) => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      submit();
      expect(saved[0]?.installedAt).toBe('2026-10-18T07:00:15.125Z');
      enter('2026-10-19T11:24:35.456');
      submit();
      expect(saved[1]?.installedAt).toBe('2026-10-19T15:24:35.456Z');
      enter('2026-03-08T02:30');
      submit();
      await fixture.whenStable();
      expect(form.get('installedAt')?.hasError('pattern')).toBe(true);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(saved).toHaveLength(2);
      enter('');
      submit();
      expect(saved[2]?.installedAt).toBe('');
    },
  );

  it.each(['2026-11-01T06:30:15.125Z', '2026-11-01T06:30:00.000Z'])(
    'keeps the original second overlap occurrence %s and uses the first for an edited time',
    async (installedAt) => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: UI_LANGUAGE, useValue: signal('en') },
          {
            provide: FLEET_DISPLAY,
            useValue: signal({ ...defaultFleetDisplay, timeZone: 'America/New_York' }),
          },
        ],
      });
      const fixture = TestBed.createComponent(DeviceDrawer);
      fixture.componentRef.setInput('dataAsOf', '2026-10-18T07:00:00.000Z');
      fixture.componentRef.setInput('value', {
        imei: '000000000000123',
        model: '',
        simIccid: '',
        vehicleId: null,
        notes: '',
        installedAt,
      } satisfies DeviceForm);
      const saved: DeviceForm[] = [];
      fixture.componentInstance.save.subscribe((value) => saved.push(value));
      await fixture.whenStable();
      const input = document.getElementById('device-installedAt');
      const element = document.getElementById('device-form');
      if (!(input instanceof HTMLInputElement) || !element) {
        throw new Error('Missing device date input or form.');
      }
      const submit = () =>
        element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      // Native inputs may omit zero seconds/fractions when their normalized value is emitted.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      submit();
      expect(saved[0]?.installedAt).toBe(installedAt);
      input.value = '2026-11-01T01:45';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      submit();
      expect(saved[1]?.installedAt).toBe('2026-11-01T05:45:00.000Z');
    },
  );
});
