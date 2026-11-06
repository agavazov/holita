import type {
  ErmCommandDisplayField,
  ErmCommandRequest,
  ErmCommandWaitingReason,
} from '../../generated/graphql/types.js';
import type { ErmCommandRequest as StoredRequest } from '../../generated/prisma/client.js';
import type { CommandRequestRelations } from './command-requests.repository.js';

const recordedReasons: Readonly<Record<string, string>> = {
  'Submission was interrupted; the command may have reached the unit and will not be replayed':
    'SUBMISSION_INTERRUPTED',
  'Request expired before submission': 'REQUEST_EXPIRED',
  'Fleet Device ownership or IMEI changed before submission': 'TARGET_CHANGED',
  'Cancelled before submission': 'OPERATOR_CANCELLED',
  'The gateway refused submission because the unit is not primary or is busy': 'GATEWAY_REFUSED',
  'Gateway submission failed or timed out; outcome is unknown and will not be replayed':
    'SUBMISSION_FAILED',
};

export function commandRequestView(
  request: StoredRequest,
  related?: CommandRequestRelations,
): ErmCommandRequest {
  const transport = request.commandId ? (related?.commands.get(request.commandId) ?? null) : null;
  const reasonCode =
    request.failureReason === null
      ? null
      : (recordedReasons[request.failureReason] ??
        (request.resultCode !== null && request.resultCode !== '01'
          ? 'DEVICE_REJECTED'
          : transport?.status === 'TIMEOUT'
            ? 'REPLY_TIMEOUT'
            : transport?.status === 'FAILED'
              ? 'TRANSPORT_FAILED'
              : 'UNKNOWN'));
  const outcomes: Record<StoredRequest['status'], string> = {
    QUEUED: 'WAITING_TO_SEND',
    SUBMITTING: transport?.status === 'SENT' ? 'WAITING_FOR_REPLY' : 'SUBMITTING',
    ANSWERED: request.resultCode === '01' ? 'ACKNOWLEDGED' : 'RESPONSE_RECEIVED',
    FAILED: reasonCode === 'DEVICE_REJECTED' ? 'REJECTED' : 'FAILED',
    EXPIRED: 'EXPIRED',
    CANCELLED: 'CANCELLED',
    UNCERTAIN: 'OUTCOME_UNKNOWN',
  };
  const requestedFields: ErmCommandDisplayField[] =
    request.action === 'READ_STATUS'
      ? ['IGNITION', 'ENGINE', 'VIN', 'MAIN_VOLTAGE', 'SIGNAL_QUALITY', 'JAMMING']
      : request.action === 'READ_VERSION'
        ? ['FIRMWARE_VERSION']
        : [];
  return {
    ...request,
    waitingReason: waitingReason(request.waitingReason),
    actionCode: request.action,
    displayParameters: {
      expiresInSeconds: Math.round(
        (request.expiresAt.getTime() - request.createdAt.getTime()) / 1000,
      ),
      requestedFields,
    },
    requestedAt: request.createdAt,
    queuedAt: request.createdAt,
    submittingAt: request.submittedAt,
    sentAt: transport?.sentAt ?? null,
    answeredAt: transport?.answeredAt ?? null,
    failedAt: request.status === 'FAILED' ? request.completedAt : null,
    expiredAt: request.status === 'EXPIRED' ? request.completedAt : null,
    cancelledAt: request.status === 'CANCELLED' ? request.completedAt : null,
    uncertainAt: request.status === 'UNCERTAIN' ? request.completedAt : null,
    outcomeCode: outcomes[request.status],
    reasonCode,
    transportCommand: transport,
    configurationVerification: related?.configurations.get(request.id) ?? null,
    sentFrame: request.commandId ? (related?.frames.get(request.commandId) ?? null) : null,
    receivedFrameHex: transport?.responseHex ?? null,
  };
}

function waitingReason(reason: string | null): ErmCommandWaitingReason | null {
  switch (reason) {
    case 'GATEWAY_UNAVAILABLE':
    case 'FLEET_VERIFICATION_UNAVAILABLE':
    case 'UNIT_NOT_CONNECTED':
      return reason;
    default:
      return null;
  }
}
