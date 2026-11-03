export interface CapturedFrame {
  raw: Buffer;
  partial: boolean;
  terminated?: true;
}

const maxFrameBytes = 16_384;

export class FrameSplitter {
  private pending: Buffer = Buffer.alloc(0);
  private partial = false;

  push(chunk: Buffer): CapturedFrame[] {
    this.pending = Buffer.concat([this.pending, chunk]);
    const frames: CapturedFrame[] = [];
    while (this.pending.length > 0) {
      const end = this.pending.indexOf('\r\n');
      if (end >= 0 && end <= maxFrameBytes) {
        frames.push({
          raw: this.pending.subarray(0, end),
          partial: this.partial,
          ...(this.partial && { terminated: true as const }),
        });
        this.pending = this.pending.subarray(end + 2);
        this.partial = false;
      } else if (
        this.pending.length > maxFrameBytes &&
        !(this.pending.length === maxFrameBytes + 1 && this.pending.at(-1) === 0x0d)
      ) {
        frames.push({ raw: this.pending.subarray(0, maxFrameBytes), partial: true });
        this.pending = this.pending.subarray(maxFrameBytes);
        this.partial = true;
      } else {
        break;
      }
    }
    return frames;
  }

  flush(): CapturedFrame[] {
    const frames: CapturedFrame[] = [];
    for (let start = 0; start < this.pending.length; start += maxFrameBytes) {
      frames.push({ raw: this.pending.subarray(start, start + maxFrameBytes), partial: true });
    }
    this.pending = Buffer.alloc(0);
    this.partial = false;
    return frames;
  }
}
