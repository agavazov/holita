import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { formatNumber } from '../format/format';
import { interpolate, uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

export interface SparkPoint {
  /** Epoch milliseconds. */
  readonly at: number;
  /** `null` breaks the line (no data). */
  readonly value: number | null;
}

const width = 240;
const height = 48;
const pad = 2;

/** A compact trend line with gaps for missing values and a spoken summary. */
@Component({
  selector: 'holita-sparkline',
  template: `
    <svg
      class="sparkline__svg"
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="summary()"
    >
      <line
        class="sparkline__base"
        x1="0"
        [attr.y1]="height - 0.5"
        [attr.x2]="width"
        [attr.y2]="height - 0.5"
      />
      @for (line of lines(); track $index) {
        <polyline class="sparkline__line" [attr.points]="line" />
      }
      @if (last(); as last) {
        <!-- A zero-length round-capped stroke stays circular when the plot stretches. -->
        <path class="sparkline__dot" [attr.d]="'M' + last.x + ' ' + last.y + 'h0'" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      min-inline-size: 0;
    }
    .sparkline__svg {
      display: block;
      inline-size: 100%;
      block-size: 3rem;
      overflow: visible;
    }
    .sparkline__base {
      stroke: var(--p-content-border-color);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .sparkline__line {
      fill: none;
      stroke: var(--p-primary-color);
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .sparkline__dot {
      stroke: var(--p-primary-color);
      stroke-width: 6;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly label = input.required<string>();
  readonly points = input.required<readonly SparkPoint[]>();
  readonly from = input.required<number>();
  readonly to = input.required<number>();
  readonly unit = input('');
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);

  protected readonly width = width;
  protected readonly height = height;
  private readonly language = inject(UI_LANGUAGE);

  private readonly range = computed(() => {
    const values = this.points()
      .map((point) => point.value)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const low = this.min() ?? Math.min(...values);
    const high = this.max() ?? Math.max(...values);
    return { values, low, high: high > low ? high : low + 1 };
  });

  private position(point: SparkPoint & { readonly value: number }) {
    const { low, high } = this.range();
    const span = Math.max(1, this.to() - this.from());
    const x = ((point.at - this.from()) / span) * width;
    const y = pad + (1 - (point.value - low) / (high - low)) * (height - 2 * pad);
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  }

  protected readonly lines = computed(() => {
    const lines: string[] = [];
    let current: string[] = [];
    for (const point of this.points()) {
      if (point.value === null || !Number.isFinite(point.value)) {
        if (current.length) {
          lines.push(current.join(' '));
        }
        current = [];
        continue;
      }
      const { x, y } = this.position({ at: point.at, value: point.value });
      current.push(`${String(x)},${String(y)}`);
    }
    if (current.length) {
      lines.push(current.join(' '));
    }
    return lines;
  });

  protected readonly last = computed(() => {
    const point = [...this.points()].reverse().find((item) => item.value !== null);
    return point?.value === null || point === undefined
      ? null
      : this.position({ at: point.at, value: point.value });
  });

  protected readonly summary = computed(() => {
    const language = this.language();
    const text = uiMessages[language].chart;
    const { values } = this.range();
    if (!values.length) {
      return interpolate(text.sparklineEmpty, { label: this.label() });
    }
    const unit = this.unit() ? `\u00a0${this.unit()}` : '';
    const lastValue = [...this.points()].reverse().find((point) => point.value !== null)?.value;
    return interpolate(text.sparkline, {
      label: this.label(),
      min: formatNumber(Math.min(...values), language, { fraction: 1 }),
      max: formatNumber(Math.max(...values), language, { fraction: 1 }) + unit,
      last: formatNumber(lastValue, language, { fraction: 1 }) + unit,
    });
  });
}
