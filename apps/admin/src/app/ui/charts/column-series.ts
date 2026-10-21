import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

export interface SeriesPoint {
  readonly key: string;
  readonly label: string;
  /** `null` is an empty slot (no data); `0` is a measured zero (hairline). */
  readonly value: number | null;
  readonly valueText: string;
}

/** Vertical bars scaled to the largest value, with a visually hidden data table. */
@Component({
  selector: 'holita-column-series',
  template: `
    <div class="column-series__plot" aria-hidden="true">
      @for (bar of bars(); track bar.key) {
        <div class="column-series__slot" [title]="bar.label + ': ' + bar.valueText">
          @if (bar.height === null) {
            <span class="column-series__gap"></span>
          } @else {
            <span
              class="column-series__bar"
              [class.column-series__bar--zero]="bar.height === 0"
              [class.column-series__bar--highlight]="bar.highlight"
              [style.height.%]="bar.height"
            ></span>
          }
        </div>
      }
    </div>
    <div class="column-series__axis" aria-hidden="true">
      @for (bar of bars(); track bar.key) {
        <span class="column-series__tick">{{ bar.showLabel ? bar.label : '' }}</span>
      }
    </div>
    <div class="app-visually-hidden">
      <table>
        <caption>
          {{
            label()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ text().period }}</th>
            <th scope="col">{{ text().value }}</th>
          </tr>
        </thead>
        <tbody>
          @for (point of points(); track point.key) {
            <tr>
              <th scope="row">{{ point.label }}</th>
              <td>{{ point.valueText }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './column-series.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'figure', '[attr.aria-label]': 'label()' },
})
export class ColumnSeries {
  readonly label = input.required<string>();
  readonly points = input.required<readonly SeriesPoint[]>();
  readonly highlightLast = input(true);

  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()].chart);
  protected readonly bars = computed(() => {
    const points = this.points();
    const max = Math.max(0, ...points.map((point) => point.value ?? 0));
    const every = Math.max(1, Math.ceil(points.length / 7));
    const last = points.length - 1;
    return points.map((point, index) => ({
      key: point.key,
      label: point.label,
      valueText: point.valueText,
      height: point.value === null ? null : max > 0 ? (Math.max(point.value, 0) / max) * 100 : 0,
      highlight: this.highlightLast() && index === last,
      // Counted back from the latest bar, so the newest label is always shown and never crowded.
      showLabel: (last - index) % every === 0,
    }));
  });
}
