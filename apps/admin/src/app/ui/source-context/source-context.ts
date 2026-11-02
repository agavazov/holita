import type {
  SourceProvenance,
  SourcePeriod,
  SourceCoverage,
  SourceAvailability,
} from './source-types';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';

import type { Language } from '../../i18n/messages';
import { formatDateTime, formatNumber } from '../format/format';
import bg from './bg.json';
import en from './en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

/** Shared source facts; the owning feature supplies evidence and its selection. */
@Component({
  selector: 'holita-source-context',
  imports: [Tag],
  templateUrl: './source-context.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.lang]': 'language()' },
})
export class SourceContext {
  readonly language = input.required<Language>();
  readonly provenance = input.required<SourceProvenance>();
  readonly period = input<SourcePeriod | null>(null);
  readonly coverage = input<SourceCoverage | null>(null);
  readonly availability = input<SourceAvailability | null>(null);
  readonly compact = input(false);

  protected readonly text = computed(() => catalogs[this.language()]);
  protected readonly periodZone = computed(() => this.period()?.timeZone ?? 'UTC');
  protected readonly positionsLoaded = computed(() =>
    formatNumber(this.coverage()?.positionsLoaded, this.language()),
  );
  protected readonly gapCount = computed(() =>
    formatNumber(this.coverage()?.gaps.length, this.language()),
  );

  protected time(value: string | null, timeZone = 'UTC'): string {
    return formatDateTime(value, this.language(), timeZone, true);
  }
}
