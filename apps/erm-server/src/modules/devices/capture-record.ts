import type { ChecksumState } from '../../starlink/index.js';

type ConnectionRecord = { connection: number };

export type CaptureRecord = ConnectionRecord &
  (
    | { event: 'open'; peer: string }
    | { event: 'forwarded'; upstream: string }
    | { event: 'rejected'; reason: string; head?: string }
    | { event: 'upstream-error'; message: string }
    | { event: 'close'; seconds: number; deviceBytes: number; serverBytes: number }
    | {
        from: 'device' | 'server';
        unit?: string;
        command?: string;
        reference?: string;
        checksum?: ChecksumState;
        partial?: true;
        frame: string;
      }
  );
