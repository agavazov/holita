import type {
  ErmCommandDisplayField,
  ErmCommandRequest,
  ErmCommandWaitingReason,
  ErmParameterValue,
} from '../../generated/graphql/types.js';
import type { ErmCommandRequest as StoredRequest } from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import type { CommandRequestRelations } from './command-requests.repository.js';
import { maskCommandEvidence, maskFrameEvidence } from './command-evidence.js';
import { maskConfigurationChange } from './configuration-change-view.js';
import { parameterCatalog } from '../../starlink/parameter-catalog.js';

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
  context?: RequestContext,
): ErmCommandRequest {
  const storedTransport = request.commandId
    ? (related?.commands.get(request.commandId) ?? null)
    : null;
  const transport = storedTransport ? maskCommandEvidence(storedTransport, context) : null;
  const sentFrame = request.commandId ? (related?.frames.get(request.commandId) ?? null) : null;
  const verification = related?.configurations.get(request.id) ?? null;
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
    parameterValues: parameterValues(request),
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
    configurationVerification: verification ? maskConfigurationChange(verification, context) : null,
    sentFrame: sentFrame ? maskFrameEvidence(sentFrame, context) : null,
    receivedFrameHex: transport?.responseHex ?? null,
    faultReadVerdict: related?.faultReadVerdicts.get(request.id) ?? null,
  };
}

/** The 03 reply is `parameter,value`; a 45 reply lists `parameter,value` pairs. */
function parameterValues(request: StoredRequest): ErmParameterValue[] {
  if (request.action !== 'READ_PARAMETERS' || request.status !== 'ANSWERED') {
    return [];
  }
  const fields = request.responseText?.split(',') ?? [];
  const values = new Map<number, string>();
  if (request.parameters.length === 1 && fields.length >= 2) {
    values.set(Number(fields[0]), fields.slice(1).join(','));
  } else {
    for (let index = 0; index + 1 < fields.length; index += 2) {
      values.set(Number(fields[index]), fields[index + 1] ?? '');
    }
  }
  return request.parameters.map((parameter) => {
    const raw = values.get(parameter);
    return {
      parameter,
      title: parameterCatalog.get(parameter) ?? null,
      value:
        raw === undefined
          ? null
          : raw.startsWith('"') && raw.endsWith('"')
            ? raw.slice(1, -1)
            : raw,
      resultCode: null,
      outcome: raw === undefined ? 'OMITTED' : 'READ',
    };
  });
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
