import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  defaultFleetDisplay,
  FLEET_DISPLAY,
  type FleetDisplayPreferences,
} from '../../../ui/format/fleet-format';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import {
  type DriverScorecard,
  DriverScorecardView,
  maneuverKinds,
  type ScorecardPeriod,
} from './driver-scorecard-view';

const card: DriverScorecard = {
  name: 'Test Driver',
  employeeNo: 'E-101',
  asOf: '2026-10-18T07:00:00.000Z',
  windowStart: '2026-09-18T07:00:00.000Z',
  windowEnd: '2026-10-18T07:00:00.000Z',
  distanceKm: 1200,
  tripCount: 8,
  scoredTripCount: 6,
  averageDrivingScore: 0,
  averageEcoScore: null,
  maneuverCount: 3,
  maneuversPer100Km: 0.25,
  lowConfidence: false,
  maneuvers: maneuverKinds.map((kind, index) => ({
    kind,
    intensity1: index === 0 ? 1 : 0,
    intensity2: 0,
    intensity3: 0,
    intensityUnknown: index === 0 ? 2 : 0,
    total: index === 0 ? 3 : 0,
  })),
};

describe('DriverScorecardView', () => {
  function render(
    overrides: Partial<DriverScorecard> = {},
    display: FleetDisplayPreferences = defaultFleetDisplay,
  ) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: FLEET_DISPLAY, useValue: signal(display) },
      ],
    });
    const fixture = TestBed.createComponent(DriverScorecardView);
    fixture.componentRef.setInput('state', 'ready');
    fixture.componentRef.setInput('scorecard', { ...card, ...overrides });
    fixture.componentRef.setInput('backLink', ['/drivers']);
    fixture.detectChanges();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('Missing scorecard element.');
    }
    return { fixture, root };
  }

  it('keeps a zero driving score distinct from an absent eco score and shows coverage', () => {
    const { root } = render();
    const values = Array.from(root.querySelectorAll('.kpi-tile__value')).map((value) =>
      value.textContent.trim(),
    );
    expect(values.slice(0, 2)).toEqual(['0', '—']);
    expect(root.textContent).toContain('with a driving score: 6 of 8');
    expect(root.textContent).not.toContain('Limited data:');
  });

  it('converts the maneuver rate denominator with the selected distance unit', () => {
    const { root, fixture } = render(
      { distanceKm: 160.9344, maneuversPer100Km: 1 },
      { ...defaultFleetDisplay, distanceUnit: 'MI' },
    );
    const tile = Array.from(root.querySelectorAll('holita-kpi-tile')).find((item) =>
      item.textContent.includes('Maneuvers per 100 mi'),
    );
    expect(tile?.querySelector('.app-num')?.textContent.trim()).toBe('1.6');
    expect(root.textContent).toContain('100 mi');
    expect(root.textContent).not.toContain('{unit}');
    expect(fixture.componentInstance.scorecard()?.maneuversPer100Km).toBe(1);
  });

  it('keeps zero-count categories and the separate unknown-intensity count accessible', () => {
    const { root } = render();
    const rows = root.querySelectorAll('holita-stacked-bars tbody tr');
    expect(rows.length).toBe(9);
    expect(Array.from(rows[0]?.children ?? []).map((cell) => cell.textContent)).toEqual([
      'Harsh acceleration',
      '1',
      '0',
      '0',
      '2',
      '3',
    ]);
    expect(Array.from(rows[1]?.children ?? []).map((cell) => cell.textContent)).toEqual([
      'Harsh braking',
      '0',
      '0',
      '0',
      '0',
      '0',
    ]);
  });

  it('emits a period selection without changing the supplied period', () => {
    const { fixture, root } = render();
    const selected: ScorecardPeriod[] = [];
    fixture.componentInstance.periodChange.subscribe((period) => selected.push(period));
    const buttons = Array.from(root.querySelectorAll('button'));
    buttons.find((button) => button.textContent.trim() === '7 days')?.click();
    expect(selected).toEqual([7]);
    expect(
      buttons
        .find((button) => button.textContent.trim() === '30 days')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows the backend low-confidence flag and distinguishes no trips from no telemetry', () => {
    const { fixture, root } = render({ scoredTripCount: 3, lowConfidence: true });
    expect(root.textContent).toContain('Limited data: fewer than five trips');
    fixture.componentRef.setInput('scorecard', {
      ...card,
      tripCount: 0,
      scoredTripCount: 0,
      lowConfidence: true,
    });
    fixture.detectChanges();
    expect(root.textContent).toContain('No trips in this period');
    expect(root.textContent).not.toContain('Limited data:');
    fixture.componentRef.setInput('scorecard', {
      ...card,
      asOf: null,
      windowStart: null,
      windowEnd: null,
    });
    fixture.detectChanges();
    expect(root.textContent).toContain('No telemetry yet');
    expect(root.querySelector('holita-kpi-strip')).toBeNull();
    expect(root.querySelector('holita-stacked-bars')).toBeNull();
  });

  it('keeps errors separate from stale metrics and emits retry', () => {
    const { fixture, root } = render();
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    fixture.componentRef.setInput('state', 'error');
    fixture.detectChanges();
    expect(root.querySelector('holita-kpi-strip')).toBeNull();
    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'Try again')
      ?.click();
    expect(retries).toBe(1);
  });
});
