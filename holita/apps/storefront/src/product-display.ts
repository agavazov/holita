import { toneSeverity, type StatusTone } from '@osnova/ui';
import type { CatalogueBadgeColor } from './generated/operations';

const badgeTones: Record<CatalogueBadgeColor, StatusTone> = {
  ACCENT: 'accent',
  NEUTRAL: 'neutral',
  INFO: 'info',
  SUCCESS: 'success',
  WARN: 'warn',
  DANGER: 'danger',
};

export function badgeSeverity(color: CatalogueBadgeColor) {
  return toneSeverity(badgeTones[color]);
}

export function availabilitySeverity(available: boolean) {
  return toneSeverity(available ? 'success' : 'neutral');
}
