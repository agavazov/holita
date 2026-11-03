import { decodeBinaryEvent, decodeEvent, type DecodedEvent } from './event.js';
import { inflateContainer, parseFrame } from './protocol.js';

export function* decodeFrameEvents(
  raw: Buffer,
  command: string | null | undefined,
  eventStructure: readonly string[],
): Generator<DecodedEvent, void, undefined> {
  // Tracker units send binary $SLB reports and batch frames into compressed $SLC containers.
  const container = command == null ? inflateContainer(raw) : undefined;
  const binary = command == null && !container;
  for (const inner of container ?? (binary || command === '06' || command === '86' ? [raw] : [])) {
    let event: DecodedEvent | undefined;
    if (inner.subarray(0, 4).toString('latin1') === '$SLB') {
      event = decodeBinaryEvent(inner);
    } else {
      const parsed = parseFrame(inner);
      if (!parsed) {
        throw new Error('Invalid event envelope.');
      }
      if (parsed.command !== '06' && parsed.command !== '86') {
        continue;
      }
      event = decodeEvent(parsed, eventStructure);
    }
    if (event) {
      yield event;
    }
  }
}
