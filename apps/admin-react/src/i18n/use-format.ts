import { useTranslation } from 'react-i18next';
import type { Language } from './i18n.js';

export function createFormat(language: Language) {
  const locale = language === 'bg' ? 'bg-BG' : 'en-GB';
  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Sofia',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    ...dateOptions,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  const date = new Intl.DateTimeFormat(locale, dateOptions);
  const dateTime = new Intl.DateTimeFormat(locale, timeOptions);
  const historyTime = new Intl.DateTimeFormat(locale, {
    ...timeOptions,
    second: '2-digit',
  });
  return {
    number: (value: number) => number.format(value),
    decimal: (value: string | number) => decimal.format(Number(value)),
    date: (value: string) => date.format(new Date(value)),
    dateTime: (value: string) => dateTime.format(new Date(value)),
    historyTime: (value: string) => historyTime.format(new Date(value)),
  };
}

const formats = { bg: createFormat('bg'), en: createFormat('en') };

export function useFormat() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'bg';
  return formats[language];
}
