import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ColumnSeries } from '../../../ui/charts/column-series';
import {
  defaultFleetDisplay,
  FLEET_DISPLAY,
  type FleetDisplayPreferences,
} from '../../../ui/format/fleet-format';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import type { AlertRow } from '../alerts/alerts-view';
import { VehicleProfileView, type VehicleProfile } from './vehicle-profile-view';

const vehicle: VehicleProfile = {
  id: 'v1',
  plate: 'CB 1000 AA',
  fleetNumber: null,
  type: null,
  make: '',
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
  openAlerts: 1,
  notes: '',
  vin: '',
  fuelType: null,
  tankL: null,
  speedKph: null,
  createdAt: '2026-10-18T07:00:00.000Z',
};

describe('VehicleProfileView', () => {
  async function render(display: FleetDisplayPreferences = defaultFleetDisplay) {
    const preferences = signal(display);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: FLEET_DISPLAY, useValue: preferences },
      ],
    });
    const fixture = TestBed.createComponent(VehicleProfileView);
    fixture.componentRef.setInput('state', 'ready');
    fixture.componentRef.setInput('vehicle', vehicle);
    fixture.componentRef.setInput('dataAsOf', '2026-10-18T07:00:00.000Z');
    fixture.componentRef.setInput('backLink', ['/vehicles']);
    fixture.detectChanges();
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing profile.');
    }
    const host = element;
    function kpi(label: string): string | undefined {
      return Array.from(host.querySelectorAll('holita-kpi-tile'))
        .find((tile) => tile.querySelector('.kpi-tile__label')?.textContent.trim() === label)
        ?.querySelector('.kpi-tile__value .app-num')
        ?.textContent.trim();
    }
    return { fixture, element, kpi, preferences };
  }

  it('keeps unknown distance distinct from a measured zero and tolerates absent specifications', async () => {
    const { fixture, element, kpi } = await render();
    expect(kpi('Distance, 14 days')).toBe('—');
    expect(element.textContent).not.toContain('null');
    fixture.componentRef.setInput('distance', [
      { key: 'd1', label: '18 Oct', value: 0, valueText: '0 km' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(kpi('Distance, 14 days')).toBe('0');
  });

  it('uses the exact Vehicle count independently of the loaded alerts page', async () => {
    const { fixture, kpi } = await render();
    const alert: AlertRow = {
      id: 'a1',
      vehicleId: 'v1',
      plate: vehicle.plate,
      driverName: null,
      kind: 'Low fuel',
      detail: '',
      severity: 'WARNING',
      status: 'OPEN',
      occurredAt: '2026-10-18T06:00:00.000Z',
      remark: '',
    };
    fixture.componentRef.setInput('alerts', [
      alert,
      { ...alert, id: 'a2', status: 'ACKNOWLEDGED' },
      { ...alert, id: 'a3', status: 'RESOLVED' },
    ]);
    fixture.componentRef.setInput('vehicle', { ...vehicle, openAlerts: 17 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(kpi('Open alerts')).toBe('17');
  });

  it('converts profile values and chart data together while preserving canonical inputs and measured zero', async () => {
    const { fixture, element, kpi, preferences } = await render({
      ...defaultFleetDisplay,
      timeZone: 'America/New_York',
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
    });
    const points = [
      { key: 'zero', label: '17 Oct', value: 0, valueText: '0 km' },
      { key: 'distance', label: '18 Oct', value: 160.9344, valueText: '161 km' },
    ];
    fixture.componentRef.setInput('vehicle', {
      ...vehicle,
      odometerKm: 160.9344,
      speedKph: 160.9344,
      tankL: 3.785411784,
    });
    fixture.componentRef.setInput('distance', points);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(kpi('Odometer')).toBe('100');
    expect(kpi('Distance, 14 days')).toBe('100');
    expect(element.textContent).toContain('100 mph');
    expect(element.textContent).toContain('1 gal');
    expect(element.textContent).toContain('03:00');
    const chart = fixture.debugElement.query(By.directive(ColumnSeries)).injector.get(ColumnSeries);
    expect(chart.points()).toMatchObject([
      { value: 0, valueText: '0 mi' },
      { valueText: '100 mi' },
    ]);
    expect(chart.points()[1]?.value).toBeCloseTo(100);
    expect(fixture.componentInstance.distance()).toEqual(points);
    expect(fixture.componentInstance.vehicle()?.odometerKm).toBe(160.9344);
    preferences.set(defaultFleetDisplay);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(kpi('Distance, 14 days')).toBe('161');
    expect(chart.points()[1]?.valueText).toBe('161 km');
  });
});
