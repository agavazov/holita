import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { UI_LANGUAGE } from '../ui-language';
import { ColumnSeries, type SeriesPoint } from './column-series';
import { Sparkline, type SparkPoint } from './sparkline';
import { StackedBars, barColor, type StackedRow } from './stacked-bars';

const hour = 3_600_000;

@Component({
  imports: [ColumnSeries, StackedBars, Sparkline],
  template: `
    <holita-column-series label="Пробег по дни" [points]="series()" />
    <holita-stacked-bars
      label="Маневри"
      [rows]="rows"
      [legend]="[
        { key: 'braking', label: 'Спиране', tone: 'danger' },
        { key: 'turns', label: 'Завои', tone: 'c4' },
      ]"
    />
    <holita-sparkline label="Скорост" [points]="spark()" [from]="0" [to]="4 * hour" unit="км/ч" />
  `,
})
class Host {
  readonly hour = hour;
  readonly series = signal<readonly SeriesPoint[]>([
    { key: 'd1', label: '16.10', value: 120, valueText: '120 км' },
    { key: 'd2', label: '17.10', value: 0, valueText: '0 км' },
    { key: 'd3', label: '18.10', value: null, valueText: 'няма данни' },
    { key: 'd4', label: '19.10', value: 240, valueText: '240 км' },
  ]);
  readonly rows: readonly StackedRow[] = [
    {
      key: 'v1',
      label: 'CB 1001 AX',
      total: 8,
      totalText: '8',
      segments: [
        { key: 'braking', value: 6, tone: 'danger' },
        { key: 'turns', value: 2, tone: 'c4' },
      ],
    },
    {
      key: 'v2',
      label: 'CB 1002 AX',
      total: 2,
      totalText: '2',
      segments: [{ key: 'turns', value: 2, tone: 'c4' }],
    },
  ];
  readonly spark = signal<readonly SparkPoint[]>([
    { at: 0, value: 0 },
    { at: hour, value: 96 },
    { at: 2 * hour, value: null },
    { at: 3 * hour, value: 40 },
    { at: 4 * hour, value: 72 },
  ]);
}

function element(fixture: ComponentFixture<Host>): HTMLElement {
  const value: unknown = fixture.nativeElement;
  if (!(value instanceof HTMLElement)) {
    throw new Error('Missing host element.');
  }
  return value;
}

describe('charts', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LANGUAGE, useValue: signal('bg') }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return element(fixture);
  }

  it('ColumnSeries scales to the maximum, keeps zero as a hairline and null as a gap', () => {
    const root = render();
    const series = root.querySelector('holita-column-series');
    expect(series?.getAttribute('role')).toBe('figure');
    expect(series?.getAttribute('aria-label')).toBe('Пробег по дни');
    const bars = Array.from(series?.querySelectorAll<HTMLElement>('.column-series__bar') ?? []);
    expect(bars.map((bar) => bar.style.height)).toEqual(['50%', '0%', '100%']);
    expect(bars[1]?.classList.contains('column-series__bar--zero')).toBe(true);
    expect(bars[2]?.classList.contains('column-series__bar--highlight')).toBe(true);
    expect(series?.querySelectorAll('.column-series__gap').length).toBe(1);
    const cells = Array.from(series?.querySelectorAll('table td') ?? []).map(
      (cell) => cell.textContent,
    );
    expect(cells).toEqual(['120 км', '0 км', 'няма данни', '240 км']);
  });

  it('StackedBars draws proportional segments and a full data table', () => {
    const root = render();
    const bars = root.querySelector('holita-stacked-bars');
    const segments = Array.from(
      bars?.querySelectorAll<HTMLElement>('.stacked-bars__segment') ?? [],
    );
    expect(segments.map((segment) => segment.style.width)).toEqual(['75%', '25%', '25%']);
    expect(barColor('danger')).toBe('var(--p-app-tone-danger-solid)');
    expect(barColor('c4')).toBe('var(--p-app-category-c4)');
    const rows = Array.from(bars?.querySelectorAll('table tbody tr') ?? []).map((row) =>
      Array.from(row.children).map((cell) => cell.textContent),
    );
    expect(rows).toEqual([
      ['CB 1001 AX', '6', '2', '8'],
      ['CB 1002 AX', '0', '2', '2'],
    ]);
  });

  it('Sparkline breaks the line at gaps and speaks a summary', () => {
    const root = render();
    const svg = root.querySelector('holita-sparkline svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Скорост: 0–96 км/ч, последно 72 км/ч');
    const lines = Array.from(svg?.querySelectorAll('polyline') ?? []).map((line) =>
      line.getAttribute('points'),
    );
    expect(lines).toEqual(['0,46 60,2', '180,27.67 240,13']);
    // The last value is marked by a zero-length round-capped stroke at its position.
    expect(svg?.querySelector('.sparkline__dot')?.getAttribute('d')).toBe('M240 13h0');
  });
});
