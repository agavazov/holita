import type { Prisma } from '../../generated/prisma/client.js';
import {
  karmaProfileObservation,
  type KarmaProfileReadback,
  type KarmaProfileObservation,
} from '../../integrations/karma/karma-device-reads.client.js';
import { DeviceReadEvidenceError } from './device-read-evidence.js';
import { evidenceWatermark } from './device-parameter-change.js';

export function profileWatermark(value: Prisma.JsonValue): string | undefined {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.afterMessageId === 'string' &&
    /^[1-9][0-9]*$/.test(value.afterMessageId) &&
    Number.isSafeInteger(Number(value.afterMessageId))
  ) {
    return value.afterMessageId;
  }
  return undefined;
}

export function resetProfileEvidence(value: Prisma.JsonValue): Prisma.JsonObject {
  const afterMessageId = evidenceWatermark(value) ?? profileWatermark(value);
  return {
    count: 0,
    coverageComplete: false,
    items: [],
    ...(afterMessageId ? { afterMessageId } : {}),
  };
}

export function mergeProfileEvidence(stored: Prisma.JsonValue, fresh: KarmaProfileReadback) {
  let previous: KarmaProfileObservation[] = [];
  if (!(Array.isArray(stored) && stored.length === 0)) {
    if (
      !stored ||
      typeof stored !== 'object' ||
      Array.isArray(stored) ||
      !Array.isArray(stored.items)
    ) {
      throw new DeviceReadEvidenceError('INVALID_SAVED_EVIDENCE');
    }
    previous = stored.items.map(karmaProfileObservation);
  }
  const messages = new Map<string, KarmaProfileObservation>();
  let conflict = fresh.readback.status === 'CONFLICT';
  for (const item of [...previous, ...fresh.observations]) {
    const existing = messages.get(item.messageId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) {
      conflict = true;
    }
    if (!existing) {
      messages.set(item.messageId, item);
    }
  }
  if (messages.size > 128) {
    throw new DeviceReadEvidenceError('EVIDENCE_LIMIT');
  }
  const items = [...messages.values()].sort((a, b) => Number(a.messageId) - Number(b.messageId));
  const first = items[0];
  if (
    first &&
    items.some(
      (item) =>
        item.profileId !== first.profileId ||
        item.configurationId !== first.configurationId ||
        item.messageNumber !== first.messageNumber ||
        item.lastMessage !== first.lastMessage,
    )
  ) {
    conflict = true;
  }
  const afterMessageId = profileWatermark(stored);
  const evidence: Prisma.JsonObject = {
    coverageComplete: fresh.coverageComplete,
    count: items.length,
    items: items.map((item) => ({ ...item })),
    ...(afterMessageId ? { afterMessageId } : {}),
  };
  return {
    evidence,
    conflict,
    profileId:
      !conflict && fresh.coverageComplete && first?.messageNumber === 1 && first.lastMessage
        ? first.profileId
        : null,
    observedAt: first
      ? new Date(Math.min(...items.map((item) => Date.parse(item.eventTimeUtc))))
      : null,
  };
}
