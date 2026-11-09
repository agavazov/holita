import type { ChecksumState } from '../../starlink/index.js';

type ConnectionRecord = { connection: number };

export type CaptureRecord = ConnectionRecord &
  (
    | { event: 'open'; peer: string }
    | { event: 'forwarded'; upstream: string; address?: string }
    | { event: 'rejected'; reason: string; head?: string }
    | { event: 'upstream-error'; message: string }
    | { event: 'upstream-close'; reason: string }
    | { event: 'close'; seconds: number; deviceBytes: number; serverBytes: number }
    | {
        from: 'device' | 'server' | 'discocan';
        unit?: string;
        command?: string;
        reference?: string;
        checksum?: ChecksumState;
        partial?: true;
        frame: string;
      }
  );

export interface SentCommand {
  id: string;
  unitId: string;
  reference: string;
  command: string;
  fields: string[];
  sentAt: Date;
}

export interface CommandOutcome {
  status: 'answered' | 'timeout' | 'failed';
  answeredAt?: Date;
  resultCode?: string;
  response?: Buffer;
}
