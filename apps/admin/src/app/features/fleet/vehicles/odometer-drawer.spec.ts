import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
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
    expect(wall).toBe('2026-10-18T10:00:00.000');
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

  it('uses configured zones, rejects a skipped wall time and disambiguates a half-hour overlap', () => {
    const instant = '2026-10-18T07:00:45.125Z';
    const wall = odometerWallTime(instant, 'Asia/Kathmandu');
    expect(wall).toBe('2026-10-18T12:45:45.125');
    expect(odometerInstant(wall, undefined, 'Asia/Kathmandu')).toBe(instant);
    expect(odometerInstant('2026-03-08T02:30', undefined, 'America/New_York')).toBeNull();
    expect(odometerInstant('2026-02-30T12:00', undefined, 'UTC')).toBeNull();
    expect(
      odometerInstant(
        odometerWallTime('2026-04-04T15:15:20.125Z', 'Australia/Lord_Howe'),
        { previousAt: '2026-04-04T15:00:00.000Z', latestAllowedAt: '2026-04-04T15:20:00.000Z' },
        'Australia/Lord_Howe',
      ),
    ).toBe('2026-04-04T15:15:20.125Z');
  });

  it('preserves Branch wall time even when that time is skipped in the browser zone', () => {
    // Europe/Sofia skips 03:30 on this date; a floating UTC Branch value must still remain 03:30.
    const instant = '2026-03-29T03:30:15.125Z';
    const wall = odometerWallTime(instant, 'UTC');
    expect(wall).toBe('2026-03-29T03:30:15.125');
    expect(odometerInstant(wall, undefined, 'UTC')).toBe(instant);
  });

  it('edits miles and Branch wall time, preserving the initial canonical reading and converting edits once', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UI_LANGUAGE, useValue: signal('en') },
        {
          provide: FLEET_DISPLAY,
          useValue: signal({
            ...defaultFleetDisplay,
            distanceUnit: 'MI',
            timeZone: 'America/New_York',
          }),
        },
      ],
    });
    const fixture = TestBed.createComponent(OdometerDrawer);
    fixture.componentRef.setInput('plate', 'CB 1000 AA');
    fixture.componentRef.setInput('previous', {
      odometerKm: 1000.1,
      recordedAt: '2026-10-18T06:00:00.000Z',
      source: 'DEMO',
    });
    fixture.componentRef.setInput('latestAllowedAt', '2026-10-18T07:00:00.000Z');
    const saved: OdometerReading[] = [];
    fixture.componentInstance.save.subscribe((reading) => saved.push(reading));
    await fixture.whenStable();
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    const element = document.getElementById('odometer-form');
    if (!element) {
      throw new Error('Missing odometer form.');
    }
    expect(element.textContent).toContain('Odometer, mi');
    expect(element.textContent).toContain('America/New_York time');
    const time: unknown = form.get('recordedAt')?.value;
    expect(time).toBe('2026-10-18T03:00:00.000');
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved).toEqual([{ odometerKm: 1000.1, recordedAt: '2026-10-18T07:00:00.000Z' }]);
    form.get('odometerKm')?.setValue(621.4);
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved[1]).toEqual({ odometerKm: 1000.1, recordedAt: '2026-10-18T07:00:00.000Z' });
    form.get('odometerKm')?.setValue(621.3);
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(saved).toHaveLength(2);
    expect(element.textContent).toContain('The odometer cannot be lower than the latest reading.');
    form.get('odometerKm')?.setValue(621.5);
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved[2]).toEqual({ odometerKm: 1000.2, recordedAt: '2026-10-18T07:00:00.000Z' });
  });

  it.each(['inactive', 'empty-interval'] as const)(
    'disables an unavailable %s reading rather than presenting an invalid default',
    async (reason) => {
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
      });
      const fixture = TestBed.createComponent(OdometerDrawer);
      fixture.componentRef.setInput('plate', 'CB 1000 AA');
      fixture.componentRef.setInput('inactive', reason === 'inactive');
      fixture.componentRef.setInput('previous', {
        odometerKm: 100,
        recordedAt: '2026-10-18T07:00:00.000Z',
        source: 'DEMO',
      });
      fixture.componentRef.setInput(
        'latestAllowedAt',
        reason === 'inactive' ? '2026-10-18T07:01:00.000Z' : '2026-10-18T07:00:00.000Z',
      );
      const saved: OdometerReading[] = [];
      fixture.componentInstance.save.subscribe((reading) => saved.push(reading));
      await fixture.whenStable();
      const input = document.getElementById('odometer-odometerKm');
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('Missing odometer input.');
      }
      expect(input.disabled).toBe(true);
      expect(
        document.querySelector<HTMLButtonElement>('button[form="odometer-form"]')?.disabled,
      ).toBe(true);
      expect(document.getElementById('odometer-form')?.textContent).toContain(
        reason === 'inactive'
          ? 'Manual readings are unavailable for inactive vehicles.'
          : 'No later reading time is available yet.',
      );
      document
        .getElementById('odometer-form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(saved).toEqual([]);
    },
  );

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
    expect(fixture.componentInstance.canLeave()).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      true,
    );
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved).toHaveLength(1);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('.app-drawer-actions button')?.disabled).toBe(
      false,
    );
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
