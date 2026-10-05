import bg from './bg.json';
import en from './en.json';

export type Language = 'bg' | 'en';
export const messages: Record<Language, typeof en> = { bg, en };

export function readLanguage(value: string | null): Language {
  return value === 'en' ? 'en' : 'bg';
}
