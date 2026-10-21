import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expectCatalogParity } from '../../../i18n/catalog-parity';
import { KarmaDateTime } from './karma-date-time';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

@Component({
  imports: [ReactiveFormsModule, KarmaDateTime],
  template: `
    <label for="clock">From (UTC)</label>
    <holita-karma-date-time
      inputId="clock"
      label="From (UTC)"
      [formControl]="control"
      [invalid]="invalid()"
      [invalidPart]="part()"
      describedBy="clock-error"
    />
    <p id="clock-error">Clock validation message</p>
  `,
})
class DateTimeHost {
  readonly control = new FormControl('2026-03-29T03:30:45', { nonNullable: true });
  readonly invalid = signal(false);
  readonly part = signal<'both' | 'time'>('both');
}

describe('Karma date and textual API clock', () => {
  it('keeps catalog keys and placeholders in both languages', () => {
    expectCatalogParity(en, bg);
  });

  it('keeps DST-gap hours unchanged while editing dates, time, reset and disabled state', async () => {
    const fixture = TestBed.createComponent(DateTimeHost);
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing date and time host.');
    }
    const date = element.querySelector('#clock');
    const time = element.querySelector('#clock-time');
    if (!(date instanceof HTMLInputElement) || !(time instanceof HTMLInputElement)) {
      throw new Error('Missing date and time controls.');
    }
    expect(date.value).toBe('2026-03-29');
    expect(time.value).toBe('03:30:45');
    let entered = '';
    for (const key of '2026-03-29') {
      date.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      entered += key;
      date.value = entered;
      date.dispatchEvent(new Event('input', { bubbles: true }));
    }
    date.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toBe('2026-03-29T03:30:45');
    time.value = '03:45:00';
    time.dispatchEvent(new Event('input', { bubbles: true }));
    time.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toBe('2026-03-29T03:45:00');
    expect(fixture.componentInstance.control.touched).toBe(true);
    fixture.componentInstance.control.disable();
    await fixture.whenStable();
    expect(date.disabled).toBe(true);
    expect(time.disabled).toBe(true);
    fixture.componentInstance.control.enable();
    fixture.componentInstance.control.reset('');
    await fixture.whenStable();
    expect(date.value).toBe('');
    expect(time.value).toBe('');
  });

  it('connects both inputs to field feedback and marks only the clock invalid for a time error', async () => {
    const fixture = TestBed.createComponent(DateTimeHost);
    fixture.componentInstance.invalid.set(true);
    fixture.componentInstance.part.set('time');
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing date and time host.');
    }
    const date = element.querySelector('#clock');
    const time = element.querySelector('#clock-time');
    expect(date?.getAttribute('aria-invalid')).not.toBe('true');
    expect(time?.getAttribute('aria-invalid')).toBe('true');
    expect(date?.getAttribute('aria-describedby')).toBe('clock-error');
    expect(time?.getAttribute('aria-describedby')).toBe('clock-error');
    fixture.componentInstance.part.set('both');
    await fixture.whenStable();
    expect(date?.getAttribute('aria-invalid')).toBe('true');
    fixture.componentInstance.invalid.set(false);
    await fixture.whenStable();
    expect(date?.getAttribute('aria-invalid')).not.toBe('true');
    expect(time?.getAttribute('aria-invalid')).not.toBe('true');
  });
});
