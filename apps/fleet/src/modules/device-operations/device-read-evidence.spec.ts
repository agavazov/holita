import { describe, expect, it } from '@jest/globals';
import type {
  KarmaReadback,
  KarmaReadObservation,
} from '../../integrations/karma/karma-device-reads.client.js';
import { deviceReadEvidenceJson, mergeDeviceReadEvidence } from './device-read-evidence.js';

function part(
  messageNumber: number,
  lastMessage: boolean,
  parameterId = messageNumber,
): KarmaReadObservation {
  const rawDefinition =
    parameterId.toString(16).padStart(4, '0').toUpperCase() + '0'.repeat(36) + '001E';
  return {
    messageId: String(messageNumber),
    eventTimeUtc: '2026-10-20T10:00:01.000Z',
    rawMessage: `19,0,401,0,${lastMessage ? '1' : '0'},${String(messageNumber)},7,07${rawDefinition}`,
    configurationId: '7',
    messageNumber,
    lastMessage,
    parameters: [{ parameterId, reportingIntervalSeconds: 30, rawDefinition }],
  };
}

function received(observations: KarmaReadObservation[], coverageComplete = true): KarmaReadback {
  return {
    coverageComplete,
    readback: { status: 'INCOMPLETE', configurationId: '7', parameters: [] },
    observations,
  };
}

describe('Durable multi-message readback assembly', () => {
  it('assembles saved fragments with a later poll even after process restart and source omission', () => {
    const first = mergeDeviceReadEvidence([], received([part(1, false)]));
    expect(first.status).toBe('INCOMPLETE');
    const saved = deviceReadEvidenceJson(first.evidence);
    const afterRestart = mergeDeviceReadEvidence(saved, received([part(2, true)]));
    expect(afterRestart.status).toBe('COMPLETE');
    expect(afterRestart.parameters.map((parameter) => parameter.parameterId)).toEqual([1, 2]);
    expect(afterRestart.evidence.count).toBe(2);
    expect(afterRestart.evidence.items[0]?.rawMessage).toBe(part(1, false).rawMessage);
  });

  it('deduplicates repeated observations and preserves the first evidence on conflicting duplicate IDs', () => {
    const first = mergeDeviceReadEvidence([], received([part(1, true)]));
    const saved = deviceReadEvidenceJson(first.evidence);
    expect(mergeDeviceReadEvidence(saved, received([part(1, true)])).evidence.count).toBe(1);
    const changed = { ...part(1, true), rawMessage: '19,0,401,changed' };
    const result = mergeDeviceReadEvidence(saved, received([changed]));
    expect(result.status).toBe('CONFLICT');
    expect(result.evidence.items[0]?.rawMessage).toBe(part(1, true).rawMessage);
  });

  it('requires every numbered part, one final part and complete source coverage', () => {
    expect(mergeDeviceReadEvidence([], received([part(2, true)])).status).toBe('INCOMPLETE');
    expect(mergeDeviceReadEvidence([], received([part(1, true), part(2, true)])).status).toBe(
      'CONFLICT',
    );
    expect(mergeDeviceReadEvidence([], received([part(1, true)], false)).status).toBe('INCOMPLETE');
  });

  it('rejects mixed configuration versions, conflicting fragment bodies and duplicate parameter IDs', () => {
    expect(
      mergeDeviceReadEvidence(
        [],
        received([part(1, false), { ...part(2, true), configurationId: '8' }]),
      ).status,
    ).toBe('CONFLICT');
    const duplicatePart = { ...part(1, false, 9), messageId: '3' };
    expect(mergeDeviceReadEvidence([], received([part(1, false), duplicatePart])).status).toBe(
      'CONFLICT',
    );
    expect(
      mergeDeviceReadEvidence([], received([part(1, false, 9), part(2, true, 9)])).status,
    ).toBe('CONFLICT');
  });

  it('does not trust a complete summary without the underlying fragments', () => {
    const data = received([]);
    data.readback.status = 'COMPLETE';
    expect(mergeDeviceReadEvidence([], data).status).toBe('ABSENT');
  });

  it('bounds persisted evidence rather than accepting a truncated configuration', () => {
    const parts = Array.from({ length: 129 }, (_, index) => part(index + 1, index === 128));
    expect(() => mergeDeviceReadEvidence([], received(parts))).toThrow('cannot be assembled');
  });
});
