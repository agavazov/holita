import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { DatePicker } from 'primeng/datepicker';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DeviceDrawer, type DeviceForm } from './device-drawer';

describe('Device installation date editor', () => {
  it('presents browser-local time and submits the same UTC instant, edited time or an explicit clear', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
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
    const picker: unknown = fixture.debugElement.query(By.directive(DatePicker)).componentInstance;
    expect(picker instanceof DatePicker).toBe(true);
    const input = document.getElementById('device-installedAt');
    expect(input?.getAttribute('aria-describedby')).toContain('device-installedAt-hint');
    expect(document.getElementById('device-installedAt-hint')?.textContent).toContain(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    const element = document.getElementById('device-form');
    if (!element) {
      throw new Error('Missing device form.');
    }
    const submit = () =>
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    submit();
    expect(saved[0]?.installedAt).toBe('2026-10-18T07:00:15.125Z');
    const edited = new Date(2026, 9, 19, 11, 24, 35, 456);
    form.get('installedAt')?.setValue(edited);
    submit();
    expect(saved[1]?.installedAt).toBe(edited.toISOString());
    form.get('installedAt')?.setValue(new Date('invalid'));
    submit();
    expect(saved).toHaveLength(2);
    form.get('installedAt')?.setValue(null);
    submit();
    expect(saved[2]?.installedAt).toBe('');
  });
});
