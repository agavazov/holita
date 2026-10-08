import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SubmittedWrites {
  private pending = 0;
  private paused = false;
  private readonly waiters = new Set<() => void>();

  begin(): () => void {
    if (this.paused) throw new Error('Prototype Reset is waiting for submitted writes.');
    this.pending++;
    let settled = false;
    return () => {
      if (settled) return;
      settled = true;
      this.pending--;
      if (this.pending === 0) {
        for (const resolve of this.waiters) resolve();
        this.waiters.clear();
      }
    };
  }

  async pauseAndDrain(): Promise<void> {
    if (this.paused) throw new Error('Prototype Reset is already running.');
    this.paused = true;
    if (this.pending > 0) await new Promise<void>((resolve) => this.waiters.add(resolve));
  }

  resume(): void {
    this.paused = false;
  }
}
