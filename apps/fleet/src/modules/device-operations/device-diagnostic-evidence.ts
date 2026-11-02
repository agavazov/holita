import type { Prisma } from '../../generated/prisma/client.js';
import {
  karmaDiagnosticReadback,
  type KarmaDiagnosticReadback,
} from '../../integrations/karma/karma-device-reads.client.js';

export function diagnosticEvidence(value: unknown): KarmaDiagnosticReadback {
  if (Array.isArray(value)) {
    return { coverageComplete: false, queue: [], observations: [] };
  }
  return karmaDiagnosticReadback(value);
}

export function mergeDiagnosticEvidence(
  saved: unknown,
  incoming: KarmaDiagnosticReadback,
): KarmaDiagnosticReadback {
  const previous = diagnosticEvidence(saved);
  const observations = new Map(
    previous.observations.map((observation) => [observation.messageId, observation]),
  );
  for (const observation of incoming.observations) {
    observations.set(observation.messageId, observation);
  }
  const items = [...observations.values()].sort(
    (left, right) => Number(right.messageId) - Number(left.messageId),
  );
  return {
    coverageComplete: incoming.coverageComplete && items.length <= 64,
    queue: incoming.queue,
    observations: items.slice(0, 64),
  };
}

export function diagnosticEvidenceJson(evidence: KarmaDiagnosticReadback): Prisma.InputJsonObject {
  return {
    count: evidence.observations.length,
    coverageComplete: evidence.coverageComplete,
    queue: evidence.queue.map((entry) => ({ ...entry })),
    observations: evidence.observations.map((observation) => ({ ...observation })),
  };
}
