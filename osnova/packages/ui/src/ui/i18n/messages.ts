import type { Language } from '../../i18n/messages';
import bg from './bg.json';
import en from './en.json';

/** Design-system texts: list states, drawers, filters, units, relative time, validation. */
export const uiMessages: Record<Language, typeof en> = { bg, en };

/** Replaces `{name}` placeholders; unknown placeholders stay as written. */
export function interpolate(
  text: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
