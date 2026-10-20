import { createHash } from 'node:crypto';

/** UUID v5 layout in the private, deterministic Fleet demo namespace. */
export function demoId(table: string, key: string): string {
  const bytes = createHash('sha1')
    .update(`holita:fleet-demo:v1:${table}:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function masterId(kind: 'group' | 'driver' | 'vehicle' | 'device', ordinal: number): string {
  const prefixes = {
    group: '50000000',
    driver: '40000000',
    vehicle: '20000000',
    device: '30000000',
  };
  return `${prefixes[kind]}-0000-4000-8000-0000000010${String(ordinal).padStart(2, '0')}`;
}

export const DEMO_CLOCK_SAMPLE_ID = demoId('sample', 'branch-clock');
