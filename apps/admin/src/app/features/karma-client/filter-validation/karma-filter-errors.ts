import { convertToParamMap } from '@angular/router';
import type { Language } from '../../../i18n/messages';
import { edataFilters } from '../edata/edata-page/edata-filters';
import { eventsFilters, historyDate, tripsFilters } from '../history/history-filters';
import { karmaDateParameter } from '../karma-date-time';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

export type KarmaFilterKind = 'edata' | 'trips' | 'events' | 'profile';
export type KarmaFilterField = 'size' | 'from' | 'to' | 'parameters' | 'types';
export interface KarmaFilterError {
  readonly message: string;
  readonly part?: 'time';
}
export type KarmaFilterErrors = Partial<Record<KarmaFilterField, KarmaFilterError>>;
interface FilterDraft {
  readonly from: string;
  readonly to: string;
  readonly size?: number;
  readonly parameters?: string;
  readonly types?: string;
}

/** Explain individual draft fields; the resource's existing parser still decides acceptance. */
export function karmaFilterErrors(
  kind: KarmaFilterKind,
  draft: FilterDraft,
  language: Language,
): KarmaFilterErrors {
  const text = language === 'bg' ? bg : en;
  const errors: KarmaFilterErrors = {};
  const from = karmaDateParameter(draft.from);
  const to = karmaDateParameter(draft.to);
  const fromDate = historyDate(from);
  const toDate = historyDate(to);
  for (const [field, value, parsed] of [
    ['from', from, fromDate],
    ['to', to, toDate],
  ] as const) {
    if (parsed === undefined) {
      const date = value.split('T')[0] ?? '';
      const validDate = historyDate(`${date}T00:00:00`) !== undefined;
      errors[field] = validDate ? { message: text.time, part: 'time' } : { message: text.date };
    } else if (parsed === null && kind === 'profile') {
      errors[field] = { message: text.requiredDate };
    } else if (parsed === null && !!(field === 'from' ? to : from)) {
      errors[field] = { message: text.pairedDate };
    }
  }
  if (fromDate && toDate && fromDate > toDate) {
    errors.to = { message: text.dateOrder };
  }
  if (
    kind !== 'profile' &&
    !tripsFilters('1', convertToParamMap({ size: String(draft.size ?? 50) }))
  ) {
    errors.size = { message: text.pageSize };
  }
  if (
    kind === 'edata' &&
    !edataFilters('1', convertToParamMap({ parameters: draft.parameters?.trim() ?? '' }))
  ) {
    errors.parameters = { message: text.parameterIds };
  }
  if (
    kind === 'events' &&
    !eventsFilters('1', convertToParamMap({ types: draft.types?.trim() ?? '' }))
  ) {
    errors.types = { message: text.eventCodes };
  }
  return errors;
}

/** The time input follows its date in keyboard and visual order. */
export const karmaFilterFocusOrder: readonly string[] = [
  'size',
  'from',
  'from-time',
  'to',
  'to-time',
  'parameters',
  'types',
];
