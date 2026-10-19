import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { CategorySlot, StatusTone } from '../../theme/status-tones';
import { uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

export type BarTone = StatusTone | CategorySlot | 'muted';

export interface StackedSegment {
  readonly key: string;
  readonly value: number;
  readonly tone: BarTone;
}

export interface StackedRow {
  readonly key: string;
  readonly label: string;
  readonly total: number;
  readonly totalText: string;
  readonly segments: readonly StackedSegment[];
}

export interface StackedLegendItem {
  readonly key: string;
  readonly label: string;
  readonly tone: BarTone;
}

export function barColor(tone: BarTone): string {
  if (tone === 'muted') {
    return 'var(--p-content-hover-background)';
  }
  return /^c[1-8]$/.test(tone)
    ? `var(--p-app-category-${tone})`
    : `var(--p-app-tone-${tone}-solid)`;
}

/** Horizontal stacked rows with a legend and a visually hidden data table. */
@Component({
  selector: 'holita-stacked-bars',
  template: `
    <ul class="stacked-bars__legend" aria-hidden="true">
      @for (item of legend(); track item.key) {
        <li><span class="app-dot" [style.background]="color(item.tone)"></span>{{ item.label }}</li>
      }
    </ul>
    <div class="stacked-bars__rows" aria-hidden="true">
      @for (row of bars(); track row.key) {
        <span class="stacked-bars__label">{{ row.label }}</span>
        <span class="stacked-bars__track">
          @for (segment of row.segments; track segment.key) {
            <span
              class="stacked-bars__segment"
              [style.width.%]="segment.width"
              [style.background]="segment.color"
            ></span>
          }
        </span>
        <span class="stacked-bars__total app-num">{{ row.totalText }}</span>
      }
    </div>
    <table class="app-visually-hidden">
      <caption>
        {{
          label()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ text().category }}</th>
          @for (item of legend(); track item.key) {
            <th scope="col">{{ item.label }}</th>
          }
          <th scope="col">{{ text().total }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.key) {
          <tr>
            <th scope="row">{{ row.label }}</th>
            @for (item of legend(); track item.key) {
              <td>{{ valueOf(row, item.key) }}</td>
            }
            <td>{{ row.totalText }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './stacked-bars.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'figure', '[attr.aria-label]': 'label()' },
})
export class StackedBars {
  readonly label = input.required<string>();
  readonly rows = input.required<readonly StackedRow[]>();
  readonly legend = input<readonly StackedLegendItem[]>([]);
  /** Shared scale; defaults to the largest row total. */
  readonly max = input<number | null>(null);

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()].chart);
  protected readonly color = barColor;
  protected readonly bars = computed(() => {
    const rows = this.rows();
    const max = this.max() ?? Math.max(0, ...rows.map((row) => row.total));
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      totalText: row.totalText,
      segments: row.segments.map((segment) => ({
        key: segment.key,
        color: barColor(segment.tone),
        width: max > 0 ? (Math.max(segment.value, 0) / max) * 100 : 0,
      })),
    }));
  });

  protected valueOf(row: StackedRow, key: string): number {
    return row.segments.find((segment) => segment.key === key)?.value ?? 0;
  }
}
