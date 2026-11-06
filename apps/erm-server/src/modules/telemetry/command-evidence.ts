import type { ErmCommand, ErmFrame } from '../../generated/graphql/types.js';
import type {
  ErmCommand as StoredCommand,
  ErmFrame as StoredFrame,
} from '../../generated/prisma/client.js';
import { parseFrame } from '../../starlink/protocol.js';
import { displayText } from './display-text.js';

export function frameView(frame: StoredFrame): ErmFrame {
  return {
    ...frame,
    id: String(frame.id),
    displayText: displayText(frame.raw),
    rawHex: Buffer.from(frame.raw).toString('hex'),
  };
}

export function commandView(command: StoredCommand): ErmCommand {
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
  return {
    ...command,
    acknowledgement,
    responseText: response === null ? null : displayText(response),
    responseHex: response?.toString('hex') ?? null,
  };
}
