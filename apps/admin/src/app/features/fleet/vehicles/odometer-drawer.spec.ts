import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
import { OdometerDrawer, type OdometerReading } from './odometer-drawer';

describe('OdometerDrawer', () => {
  afterEach(() => {
    document.querySelectorAll('.p-drawer-mask').forEach((element) => {
      element.remove();
    });
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
});
