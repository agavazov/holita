import type { TagSeverity } from 'primeng/types/tag';
import type { StatusTone } from '../theme/status-tones';

export type { CategorySlot, StatusTone } from '../theme/status-tones';

/**
 * The PrimeNG Tag severity for a status tone. Tags take their colours from the central tone
 * tokens, so every status renders with `p-tag` and this map (there is no status wrapper).
 * `accent` is the default (primary) tag.
 */
export function toneSeverity(tone: StatusTone): TagSeverity | undefined {
  switch (tone) {
    case 'neutral':
      return 'secondary';
    case 'accent':
      return undefined;
    default:
      return tone;
  }
}
