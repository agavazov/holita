import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { VehiclesView, type VehicleRow } from './vehicles-view';

const vehicle: VehicleRow = {
  id: '50000000-0000-4000-8000-000000000001',
  plate: 'CA1234AB',
  fleetNumber: null,
  type: null,
  make: 'Volvo',
  model: '',
  year: null,
  status: 'ACTIVE',
  activity: 'NO_DEVICE',
  lastReportedAt: null,
  location: null,
  driverName: null,
  group: null,
  odometerKm: null,
  fuelPct: null,
  fuelStatus: 'NO_DATA',
  openAlerts: 0,
  notes: '',
};

describe('VehiclesView record navigation', () => {
  it('opens a vehicle profile from its plate and keeps direct editing available when profiles are disabled', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(VehiclesView);
    fixture.componentRef.setInput('branchName', 'Test Fleet');
    fixture.componentRef.setInput('dataAsOf', '2026-10-18T07:00:00.000Z');
    fixture.componentRef.setInput('rows', [vehicle]);
    fixture.componentRef.setInput('total', 1);
    fixture.componentRef.setInput('view', { kind: 'rows' });
    fixture.componentRef.setInput('state', {
      search: '',
      conditions: [],
      sort: null,
      page: 1,
      pageSize: 25,
    });
    const action = vi.fn();
    fixture.componentInstance.action.subscribe(action);
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Vehicles view.');
    }
    const plate = element.querySelector<HTMLButtonElement>('button[aria-label="Open CA1234AB"]');
    expect(plate).not.toBeNull();
    plate?.click();
    expect(action).toHaveBeenCalledWith({ action: 'profile', ids: [vehicle.id] });
    fixture.componentRef.setInput('profileEnabled', false);
    await fixture.whenStable();
    const edit = element.querySelector<HTMLButtonElement>('button[aria-label="Edit CA1234AB"]');
    expect(edit).not.toBeNull();
    edit?.click();
    expect(action).toHaveBeenLastCalledWith({ action: 'edit', ids: [vehicle.id] });
    fixture.destroy();
  });
});

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
