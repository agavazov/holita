import { inject, Pipe, type PipeTransform } from '@angular/core';
import { UI_LANGUAGE } from '../ui-language';
import { DISPLAY_PREFERENCES } from './display-preferences';
import {
  formatDateOnly,
  formatDateTime,
  formatDuration,
  formatMoneyCents,
  formatNumber,
  formatRelative,
  formatUtcInstant,
} from './format';

/** Default for standalone examples and other screens. */
export const displayTimeZone = 'Europe/Sofia';

@Pipe({ name: 'osnovaNumber' })
export class FormatNumberPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(value: number | null | undefined, fraction = 0): string {
    return formatNumber(value, this.language(), { fraction });
  }
}

@Pipe({ name: 'osnovaDateTime', pure: false })
export class FormatDateTimePipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  private readonly preferences = inject(DISPLAY_PREFERENCES);
  transform(value: string | null | undefined, timeZone?: string, seconds = false): string {
    return formatDateTime(
      value,
      this.language(),
      timeZone ?? this.preferences().timeZone,
      seconds,
      this.preferences().dateFormat,
    );
  }
}

@Pipe({ name: 'osnovaDate', pure: false })
export class FormatDateOnlyPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  private readonly preferences = inject(DISPLAY_PREFERENCES);
  transform(value: string | null | undefined): string {
    return formatDateOnly(value, this.language(), this.preferences().dateFormat);
  }
}

@Pipe({ name: 'osnovaRelative' })
export class FormatRelativePipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(
    value: string | null | undefined,
    reference: string | number | null | undefined,
  ): string {
    return formatRelative(value, reference, this.language());
  }
}

@Pipe({ name: 'osnovaDuration' })
export class FormatDurationPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(seconds: number | null | undefined): string {
    return formatDuration(seconds, this.language());
  }
}

@Pipe({ name: 'osnovaMoney' })
export class FormatMoneyPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(cents: number | null | undefined): string {
    return formatMoneyCents(cents, this.language());
  }
}

/** Pair with osnovaDateTime on the visible label to expose the exact original UTC instant. */
@Pipe({ name: 'osnovaUtcInstant' })
export class FormatUtcInstantPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatUtcInstant(value);
  }
}
