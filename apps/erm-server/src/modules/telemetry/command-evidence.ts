import type { ErmCommand, ErmFrame } from '../../generated/graphql/types.js';
import type {
  ErmCommand as StoredCommand,
  ErmFrame as StoredFrame,
} from '../../generated/prisma/client.js';
import type { RequestContext } from '../../graphql/request-context.js';
import { inflateContainer, parseFrame } from '../../starlink/protocol.js';
import { displayText } from './display-text.js';
import { isViewer, maskParameterValue, protectedParameter } from './operator-roles.js';

function containsSecretValues(raw: Buffer): boolean {
  const contained = inflateContainer(raw);
  if (contained) {
    return contained.some(containsSecretValues);
  }
  const frame = parseFrame(raw);
  return (
    frame !== undefined &&
    ((frame.origin === 'SLU' && ['03', '45'].includes(frame.command)) ||
      (frame.origin === 'SRV' && ['04', '46'].includes(frame.command))) &&
    frame.fields.some(
      (field, index) =>
        index % 2 === 0 &&
        frame.fields[index + 1] !== undefined &&
        protectedParameter(field.toString('latin1')),
    )
  );
}

export function maskFrameEvidence(frame: ErmFrame, context?: RequestContext): ErmFrame {
  return isViewer(context) && containsSecretValues(Buffer.from(frame.rawHex, 'hex'))
    ? { ...frame, displayText: '[REDACTED]', rawHex: '' }
    : frame;
}

export function maskCommandEvidence(command: ErmCommand, context?: RequestContext): ErmCommand {
  if (!isViewer(context)) {
    return command;
  }
  const maskedResponse =
    command.responseHex !== null &&
    command.responseHex !== undefined &&
    containsSecretValues(Buffer.from(command.responseHex, 'hex'));
  return {
    ...command,
    fields: ['04', '46'].includes(command.command)
      ? command.fields.map((field, index) =>
          index % 2 === 1
            ? (maskParameterValue(command.fields[index - 1] ?? '', field, context) ?? field)
            : field,
        )
      : command.fields,
    responseText: maskedResponse ? '[REDACTED]' : (command.responseText ?? null),
    responseHex: maskedResponse ? null : (command.responseHex ?? null),
  };
}

export function frameView(frame: StoredFrame, context?: RequestContext): ErmFrame {
  return maskFrameEvidence(
    {
      ...frame,
      id: String(frame.id),
      displayText: displayText(frame.raw),
      rawHex: Buffer.from(frame.raw).toString('hex'),
    },
    context,
  );
}

export function commandView(command: StoredCommand, context?: RequestContext): ErmCommand {
  const response = command.response === null ? null : Buffer.from(command.response);
  const parsed = response === null ? undefined : parseFrame(response);
  const originalReference = parsed?.fields[0]?.toString('latin1');
  const resultCode = parsed?.fields[1]?.toString('latin1');
  const acknowledgement =
    parsed?.origin === 'SLU' &&
    parsed.command === '02' &&
    parsed.unitId === command.unitId &&
    originalReference === command.reference &&
    resultCode !== undefined &&
    command.answeredAt !== null
      ? {
          commandId: command.id,
          commandReference: command.reference,
          replyReference: parsed.reference,
          resultCode,
          receivedAt: command.answeredAt,
        }
      : null;
  return maskCommandEvidence(
    {
      ...command,
      acknowledgement,
      responseText: response === null ? null : displayText(response),
      responseHex: response?.toString('hex') ?? null,
    },
    context,
  );
}
