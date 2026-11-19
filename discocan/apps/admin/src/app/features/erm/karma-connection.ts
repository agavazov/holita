import type { AdminErmLiveRoutingFragment } from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { ermText } from './erm-text';

export function karmaBackup(device: AdminErmLiveRoutingFragment | null | undefined) {
  return device?.erm?.routing === 'KARMA_BACKUP' ? device.erm : null;
}

export function karmaCloseReason(value: string, language: Language): string | null {
  const text = ermText[language].connection;
  if (value === 'upstream closed') {
    return text.upstreamClosed;
  }
  return value.startsWith('upstream error:') ? text.upstreamError : null;
}
