import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import {
  OdometerDrawer,
  odometerInstant,
  odometerWallTime,
  type OdometerReading,
} from './odometer-drawer';

describe('OdometerDrawer', () => {
  afterEach(() => {
    document.querySelectorAll('.p-drawer-mask').forEach((element) => {
      element.remove();
    });
  });

  it('uses Sofia wall time independently of the browser zone', () => {
    const wall = odometerWallTime('2026-10-18T07:00:00.000Z');
    expect(wall?.getHours()).toBe(10);
    expect(odometerInstant(wall)).toBe('2026-10-18T07:00:00.000Z');
    expect(odometerInstant(null)).toBeNull();
    expect(odometerWallTime('invalid')).toBeNull();
    expect(odometerInstant(odometerWallTime('2026-10-18T07:00:45.125Z'))).toBe(
      '2026-10-18T07:00:45.125Z',
    );
  });

  it('preserves the exact initial instant when both autumn occurrences are permitted', () => {
    const latestAllowedAt = '2026-10-25T01:30:45.750Z';
    expect(
      odometerInstant(odometerWallTime(latestAllowedAt), {
        previousAt: null,
        latestAllowedAt,
      }),
    ).toBe(latestAllowedAt);
  });

  it.each([
    {
      occurrence: 'first',
      previousAt: '2026-10-25T00:00:15.125Z',
      latestAllowedAt: '2026-10-25T00:30:45.750Z',
      editedAt: '2026-10-25T00:15:20.625Z',
    },
    {
      occurrence: 'second',
      previousAt: '2026-10-25T01:00:15.125Z',
      latestAllowedAt: '2026-10-25T01:30:45.750Z',
      editedAt: '2026-10-25T01:15:20.625Z',
    },
  ])(
    'accepts default and edited readings in the $occurrence autumn occurrence',
    async ({ previousAt, latestAllowedAt, editedAt }) => {
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
      });
      const fixture = TestBed.createComponent(OdometerDrawer);
      fixture.componentRef.setInput('plate', 'CB 1000 AA');
      fixture.componentRef.setInput('previous', {
        odometerKm: 100,
        recordedAt: previousAt,
        source: 'DEMO',
      });
      fixture.componentRef.setInput('latestAllowedAt', latestAllowedAt);
      const saved: OdometerReading[] = [];
      fixture.componentInstance.save.subscribe((value) => saved.push(value));
      await fixture.whenStable();
      const form = fixture.debugElement
        .query(By.directive(FormGroupDirective))
        .injector.get(FormGroupDirective).form;
      const element = document.getElementById('odometer-form');
      if (!element) {
        throw new Error('Missing odometer form.');
      }
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
      expect(saved).toEqual([{ odometerKm: 100, recordedAt: latestAllowedAt }]);
      form.get('recordedAt')?.setValue(odometerWallTime(editedAt));
      await fixture.whenStable();
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
      expect(saved).toEqual([
        { odometerKm: 100, recordedAt: latestAllowedAt },
        { odometerKm: 100, recordedAt: editedAt },
      ]);
    },
  );

  it('accepts a reading when the valid interval is shorter than a minute', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(OdometerDrawer);
    fixture.componentRef.setInput('plate', 'CB 1000 AA');
    fixture.componentRef.setInput('previous', {
      odometerKm: 100,
      recordedAt: '2026-10-18T07:00:15.125Z',
      source: 'DEMO',
    });
    fixture.componentRef.setInput('latestAllowedAt', '2026-10-18T07:00:45.750Z');
    const saved: OdometerReading[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.detectChanges();
    await fixture.whenStable();
    const form = document.getElementById('odometer-form');
    if (!form) {
      throw new Error('Missing odometer form.');
    }
    expect(form.textContent).toContain('18 Oct 2026, 10:00:15');
    expect(form.textContent).toContain('18 Oct 2026, 10:00:45');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved).toEqual([{ odometerKm: 100, recordedAt: '2026-10-18T07:00:45.750Z' }]);
  });

  it('accepts zero without previous data and locks submission while saving', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(OdometerDrawer);
    fixture.componentRef.setInput('plate', 'CB 1000 AA');
    fixture.componentRef.setInput('latestAllowedAt', '2026-10-18T07:00:00.000Z');
    const saved: OdometerReading[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.detectChanges();
    await fixture.whenStable();
    const input = document.getElementById('odometer-odometerKm');
    const form = document.getElementById('odometer-form');
    if (!(input instanceof HTMLInputElement) || !form) {
      throw new Error('Missing odometer form.');
    }
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved).toEqual([{ odometerKm: 0, recordedAt: '2026-10-18T07:00:00.000Z' }]);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.disabled).toBe(true);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved).toHaveLength(1);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.disabled).toBe(false);
    expect(input.value).toBe('0');
  });

  it('rounds finite input to one decimal before comparing it with the previous odometer', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(OdometerDrawer);
    fixture.componentRef.setInput('plate', 'CB 1000 AA');
    fixture.componentRef.setInput('previous', {
      odometerKm: 100.1,
      recordedAt: '2026-10-18T06:00:00.000Z',
      source: 'DEMO',
    });
    fixture.componentRef.setInput('latestAllowedAt', '2026-10-18T07:00:00.000Z');
    const saved: OdometerReading[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    form.get('odometerKm')?.setValue(100.06);
    const element = document.getElementById('odometer-form');
    if (!element) {
      throw new Error('Missing odometer form.');
    }
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved).toEqual([{ odometerKm: 100.1, recordedAt: '2026-10-18T07:00:00.000Z' }]);
    form.get('odometerKm')?.setValue(9_999_999.91);
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(form.get('odometerKm')?.hasError('max')).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it('applies the backend UTC year bounds after converting Sofia wall time', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(OdometerDrawer);
    fixture.componentRef.setInput('plate', 'CB 1000 AA');
    fixture.componentRef.setInput('latestAllowedAt', '2100-12-31T23:59:59.999Z');
    const saved: OdometerReading[] = [];
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    form.get('odometerKm')?.setValue(0);
    const element = document.getElementById('odometer-form');
    if (!element) {
      throw new Error('Missing odometer form.');
    }
    const submit = async (at: string) => {
      form.get('recordedAt')?.setValue(odometerWallTime(at));
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    await submit('1999-12-31T23:59:59.999Z');
    expect(saved).toHaveLength(0);
    expect(document.getElementById('odometer-recordedAt')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    await submit('2000-01-01T00:00:00.000Z');
    await submit('2100-12-31T23:59:59.999Z');
    expect(saved.map((reading) => reading.recordedAt)).toEqual([
      '2000-01-01T00:00:00.000Z',
      '2100-12-31T23:59:59.999Z',
    ]);
    await submit('2101-01-01T00:00:00.000Z');
    expect(saved).toHaveLength(2);
    expect(document.getElementById('odometer-recordedAt')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });
});
