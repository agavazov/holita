import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { VehiclesView } from './vehicles-view';

describe('VehiclesView thresholds', () => {
  it('keeps summary captions aligned with the current Branch preferences in both languages', async () => {
    const preferences = signal(defaultFleetDisplay);
    const language = signal<'en' | 'bg'>('en');
    TestBed.configureTestingModule({
      providers: [
        { provide: FLEET_DISPLAY, useValue: preferences },
        { provide: UI_LANGUAGE, useValue: language },
      ],
    });
    const fixture = TestBed.createComponent(VehiclesView);
    fixture.componentRef.setInput('branchName', 'Test Fleet');
    fixture.componentRef.setInput('dataAsOf', '2026-10-18T07:00:00.000Z');
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('total', 0);
    fixture.componentRef.setInput('view', { kind: 'empty' });
    fixture.componentRef.setInput('state', {
      search: '',
      conditions: [],
      sort: null,
      page: 1,
      pageSize: 25,
    });
    fixture.componentRef.setInput('kpis', {
      inOperation: 0,
      inWorkshop: 0,
      moving: 0,
      notReporting: 0,
      openAlerts: 0,
      lowFuel: 0,
    });
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Vehicles view.');
    }
    expect(element.textContent).toContain('no data for 48 h');
    expect(element.textContent).toContain('below 12 %');
    preferences.set({ ...defaultFleetDisplay, notReportingHours: 24, lowFuelPct: 20 });
    await fixture.whenStable();
    expect(element.textContent).toContain('no data for 24 h');
    expect(element.textContent).toContain('below 20 %');
    expect(element.textContent).not.toContain('no data for 48 h');
    language.set('bg');
    await fixture.whenStable();
    expect(element.textContent).toContain('без данни от 24 ч.');
    expect(element.textContent).toContain('под 20 %');
    fixture.destroy();
  });
});
