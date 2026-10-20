import { inject, Pipe, type PipeTransform } from '@angular/core';
import { UI_LANGUAGE } from '../ui-language';
import { FLEET_DISPLAY } from './fleet-format';
import {
  formatDateOnly,
  formatDateTime,
  formatDuration,
  formatMoneyCents,
  formatNumber,
  formatRelative,
} from './format';

/** Default for standalone examples and non-Fleet screens. */
export const displayTimeZone = 'Europe/Sofia';

@Pipe({ name: 'holitaNumber' })
export class FormatNumberPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(value: number | null | undefined, fraction = 0): string {
    return formatNumber(value, this.language(), { fraction });
  }
}

@Pipe({ name: 'holitaDateTime', pure: false })
export class FormatDateTimePipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  private readonly preferences = inject(FLEET_DISPLAY);
  transform(value: string | null | undefined, timeZone?: string, seconds = false): string {
    return formatDateTime(value, this.language(), timeZone ?? this.preferences().timeZone, seconds);
  }
}

@Pipe({ name: 'holitaDate' })
export class FormatDateOnlyPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(value: string | null | undefined): string {
    return formatDateOnly(value, this.language());
  }
}

@Pipe({ name: 'holitaRelative' })
export class FormatRelativePipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(
    value: string | null | undefined,
    reference: string | number | null | undefined,
  ): string {
    return formatRelative(value, reference, this.language());
  }
}

@Pipe({ name: 'holitaDuration' })
export class FormatDurationPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(seconds: number | null | undefined): string {
    return formatDuration(seconds, this.language());
  }
}

@Pipe({ name: 'holitaMoney' })
export class FormatMoneyPipe implements PipeTransform {
  private readonly language = inject(UI_LANGUAGE);
  transform(cents: number | null | undefined): string {
    return formatMoneyCents(cents, this.language());
  }
}
