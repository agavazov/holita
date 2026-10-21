import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { TripDrawer } from './trip-drawer';
import type { TripRow } from './trips-view';

const trip: TripRow = {
  id: 'trip-1',
  vehicleId: 'vehicle-1',
  plate: 'CB 1000 AA',
  driverName: null,
  startedAt: '2026-10-18T06:00:00.000Z',
  endedAt: null,
  from: null,
  to: null,
  distanceKm: null,
  durationMin: null,
  maxSpeedKph: null,
  fuelUsedL: null,
  score: null,
  events: [],
  inProgress: true,
};

describe('TripDrawer', () => {
  async function render(overrides: Partial<TripRow> = {}) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
    const fixture = TestBed.createComponent(TripDrawer);
    fixture.componentRef.setInput('trip', { ...trip, ...overrides });
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) {
      throw new Error('Missing trip drawer.');
    }
    return dialog;
  }

  it('does not invent arrival or zero metrics for an unfinished trip', async () => {
    const dialog = await render();
    expect(dialog.textContent).toContain('In progress');
    expect(dialog.textContent).not.toContain('Arrived');
    expect(dialog.textContent).not.toContain('null');
    expect(dialog.querySelectorAll('.app-timeline-event').length).toBe(1);
    expect(
      Array.from(dialog.querySelectorAll('dd')).filter((cell) => cell.textContent.trim() === '—')
        .length,
    ).toBeGreaterThan(5);
  });

  it('distinguishes a missing old end from a backend in-progress flag', async () => {
    const dialog = await render({ inProgress: false });
    expect(dialog.textContent).toContain('End not received');
    expect(dialog.textContent).not.toContain('In progress');
  });

  it('keeps a completed trip and reported zero values', async () => {
    const dialog = await render({
      endedAt: '2026-10-18T07:00:00.000Z',
      inProgress: false,
      distanceKm: 0,
      durationMin: 0,
      maxSpeedKph: 0,
    });
    expect(dialog.textContent).toContain('Arrived');
    expect(dialog.textContent).toContain('0\u00a0km');
    expect(dialog.textContent).toContain('0\u00a0km/h');
    expect(dialog.querySelectorAll('.app-timeline-event').length).toBe(2);
  });
});
