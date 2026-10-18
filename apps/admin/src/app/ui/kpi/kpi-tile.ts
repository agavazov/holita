import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, type Params } from '@angular/router';
import { ArrowDownRight } from '@primeicons/angular/arrow-down-right';
import { ArrowUpRight } from '@primeicons/angular/arrow-up-right';
import { InfoCircle } from '@primeicons/angular/info-circle';
import { Minus } from '@primeicons/angular/minus';
import { Popover } from 'primeng/popover';
import { Skeleton } from 'primeng/skeleton';
import type { StatusTone } from '../../theme/status-tones';
import { emptyValue } from '../format/format';
import { uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';
import { KpiStrip } from './kpi-strip';

export interface KpiDelta {
  readonly text: string;
  readonly trend: 'up' | 'down' | 'flat';
  readonly sentiment: 'good' | 'bad' | 'neutral';
}

/** One KPI: label, pre-formatted value (`null` → "—"), context lines, delta and explanation. */
@Component({
  selector: 'holita-kpi-tile',
  imports: [RouterLink, Popover, Skeleton, ArrowDownRight, ArrowUpRight, InfoCircle, Minus],
  templateUrl: './kpi-tile.html',
  styleUrl: './kpi-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.kpi-tile--link]': '!!link()',
    '[attr.data-tone]': 'tone()',
  },
})
export class KpiTile {
  readonly label = input.required<string>();
  readonly value = input<string | null>(null);
  readonly unit = input<string | null>(null);
  readonly secondary = input<string | null>(null);
  readonly footnote = input<string | null>(null);
  readonly delta = input<KpiDelta | null>(null);
  readonly tone = input<StatusTone | null>(null);
  readonly explanation = input<string | null>(null);
  readonly link = input<readonly string[] | null>(null);
  readonly queryParams = input<Params | null>(null);
  readonly loading = input(false);

  private readonly strip = inject(KpiStrip, { optional: true });
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()]);
  protected readonly busy = computed(() => this.loading() || (this.strip?.loading() ?? false));
  protected readonly displayValue = computed(() => this.value() ?? emptyValue);
}
