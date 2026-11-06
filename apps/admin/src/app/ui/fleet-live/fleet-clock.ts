import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map } from 'rxjs';
import { WALL_CLOCK } from '../clock';

/** Observation ages keep advancing even when the Branch data clock stops. */
export function injectFleetNow() {
  const clock = inject(WALL_CLOCK);
  return toSignal(interval(30_000).pipe(map(() => clock())), { initialValue: clock() });
}
