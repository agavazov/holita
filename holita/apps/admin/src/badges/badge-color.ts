import { operatorStrings } from '@holita/operator';
import { toneSeverity, type StatusTone } from '@osnova/ui';
import type { Language } from '@osnova/ui/app';
import type { ProductBadgeColor } from '../generated/badges-operations';

export const badgeColors: readonly ProductBadgeColor[] = [
  'ACCENT',
  'NEUTRAL',
  'INFO',
  'SUCCESS',
  'WARN',
  'DANGER',
];

const palette: Record<
  ProductBadgeColor,
  { tone: StatusTone; key: keyof typeof operatorStrings.en }
> = {
  ACCENT: { tone: 'accent', key: 'badgeColorAccent' },
  NEUTRAL: { tone: 'neutral', key: 'badgeColorNeutral' },
  INFO: { tone: 'info', key: 'badgeColorInfo' },
  SUCCESS: { tone: 'success', key: 'badgeColorSuccess' },
  WARN: { tone: 'warn', key: 'badgeColorWarn' },
  DANGER: { tone: 'danger', key: 'badgeColorDanger' },
};

export function badgeColor(color: ProductBadgeColor, language: Language) {
  const { key, tone } = palette[color];
  return { label: operatorStrings[language][key], severity: toneSeverity(tone) };
}
