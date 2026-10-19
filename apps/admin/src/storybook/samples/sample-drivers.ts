import { Injectable, signal } from '@angular/core';
import { type SampleDriver, sampleDrivers } from './fleet-samples';

/** Driver examples share changes while navigating between the list and scorecard. */
@Injectable()
export class SampleDrivers {
  readonly rows = signal<readonly SampleDriver[]>(sampleDrivers);
  private nextId = 1;

  createId(): string {
    return `example-driver-${String(this.nextId++)}`;
  }
}
