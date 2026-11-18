import bg from './bg.json';
import en from './en.json';

export type Language = 'bg' | 'en';
export const messages: Record<Language, typeof en> = { bg, en };
