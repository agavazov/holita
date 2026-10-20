import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import {
  FLEET_DISPLAY,
  defaultFleetDisplay,
  distanceValue,
  injectFleetFormat,
  volumeValue,
  type FleetDisplayPreferences,
} from './fleet-format';
import { FormatDateTimePipe } from './format.pipes';

@Component({
  selector: 'holita-fleet-format-test',
  imports: [FormatDateTimePipe],
  template: `
    <p id="instant">{{ instant | holitaDateTime }}</p>
    <p id="explicit-zone">{{ instant | holitaDateTime: 'UTC' }}</p>
    <p id="distance">{{ units.distance(distance) }}</p>
    <p id="speed">{{ units.speed(160.9344) }}</p>
    <p id="volume">{{ units.volume(3.785411784) }}</p>
    <p id="zero">{{ units.distance(0) }}</p>
    <p id="unknown">{{ units.distance(null) }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FleetFormatTest {
  readonly units = injectFleetFormat();
  readonly instant = '2026-01-01T22:30:00.000Z';
  readonly distance = 1609.344;
}

describe('Fleet display preferences', () => {
  it('converts canonical kilometres and litres exactly while preserving unknown and zero', () => {
    expect(distanceValue(1.609344, 'MI')).toBeCloseTo(1, 10);
    expect(volumeValue(3.785411784, 'US_GALLON')).toBeCloseTo(1, 10);
    expect(distanceValue(0, 'MI')).toBe(0);
    expect(volumeValue(0, 'US_GALLON')).toBe(0);
    expect(distanceValue(null, 'MI')).toBeNull();
    expect(volumeValue(null, 'US_GALLON')).toBeNull();
    expect(distanceValue(12.5, 'KM')).toBe(12.5);
    expect(volumeValue(12.5, 'LITRE')).toBe(12.5);
  });

  it('updates displayed measures and instant dates without changing canonical values or explicit zones', async () => {
    const preferences = signal<FleetDisplayPreferences>(defaultFleetDisplay);
    TestBed.configureTestingModule({
      providers: [
        { provide: FLEET_DISPLAY, useValue: preferences.asReadonly() },
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
    const fixture = TestBed.createComponent(FleetFormatTest);
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Fleet format host.');
    }
    const text = (id: string) => element.querySelector(`#${id}`)?.textContent.trim();
    expect(text('instant')).toBe('02 Jan 2026, 00:30');
    expect(text('distance')).toBe('1,609.3 km');
    expect(text('unknown')).toBe('—');
    preferences.set({
      ...defaultFleetDisplay,
      timeZone: 'Europe/Belgrade',
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
    });
    await fixture.whenStable();
    expect(text('instant')).toBe('01 Jan 2026, 23:30');
    expect(text('explicit-zone')).toBe('01 Jan 2026, 22:30');
    expect(text('distance')).toBe('1,000 mi');
    expect(text('speed')).toBe('100 mph');
    expect(text('volume')).toBe('1 gal');
    expect(text('zero')).toBe('0 mi');
    expect(text('unknown')).toBe('—');
    expect(fixture.componentInstance.distance).toBe(1609.344);
    fixture.destroy();
  });
});
