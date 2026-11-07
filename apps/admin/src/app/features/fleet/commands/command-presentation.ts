import type { AdminControlCenterCommandRequestFieldsFragment } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { toneSeverity } from '../../../ui/tones';
import bg from './bg.json';
import en from './en.json';

export type CommandRequest = AdminControlCenterCommandRequestFieldsFragment;
export const commandText: Record<Language, typeof en> = { bg, en };
export type CommandState = keyof typeof en.states;

function translated(
  catalog: Readonly<Record<string, string>>,
  code: string,
  fallback: string,
): string {
  return Object.hasOwn(catalog, code) ? (catalog[code] ?? fallback) : fallback;
}

export function commandPurpose(request: CommandRequest, language: Language): string {
  const text = commandText[language];
  return translated(text.purposes, request.actionCode, text.unknownPurpose);
}

export function commandOutcome(request: CommandRequest, language: Language): string {
  const text = commandText[language];
  return translated(text.outcomes, request.outcomeCode, text.unknownOutcome);
}

export function commandReason(request: CommandRequest, language: Language): string | null {
  const text = commandText[language];
  return request.reasonCode
    ? translated(text.reasons, request.reasonCode, text.unknownReason)
    : null;
}

export function commandState(request: CommandRequest): CommandState {
  if (request.outcomeCode === 'REJECTED' || request.reasonCode === 'DEVICE_REJECTED') {
    return 'REJECTED';
  }
  switch (request.status) {
    case 'QUEUED':
      return 'WAITING';
    case 'SUBMITTING':
      return 'SENDING';
    case 'ANSWERED':
      return request.resultCode === '01' ? 'ACKNOWLEDGED' : 'ANSWERED';
    case 'FAILED':
      return 'FAILED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'UNCERTAIN':
      return 'UNKNOWN';
  }
}

export function commandPending(request: CommandRequest): boolean {
  return request.status === 'QUEUED' || request.status === 'SUBMITTING';
}

export function commandSeverity(request: CommandRequest) {
  const state = commandState(request);
  return toneSeverity(
    state === 'ACKNOWLEDGED' || state === 'ANSWERED'
      ? 'success'
      : state === 'REJECTED' || state === 'FAILED'
        ? 'danger'
        : state === 'UNKNOWN' || state === 'EXPIRED'
          ? 'warn'
          : state === 'CANCELLED'
            ? 'neutral'
            : 'info',
  );
}

export function commandNextStep(request: CommandRequest, language: Language): string {
  const text = commandText[language];
  const hints: Record<CommandState, string> = {
    WAITING: text.waitingHint,
    SENDING: text.sendingHint,
    ACKNOWLEDGED: text.acknowledgedHint,
    ANSWERED: text.answeredHint,
    REJECTED: text.rejectedHint,
    FAILED: text.failedHint,
    EXPIRED: text.expiredHint,
    CANCELLED: text.cancelledHint,
    UNKNOWN: text.unknownHint,
  };
  return hints[commandState(request)];
}
