import { InjectionToken } from '@angular/core';

/**
 * The wall clock in epoch milliseconds, for stale-data banners, "not in the future" validation
 * and default form times. Stories replace it with a fixed instant.
 */
export const WALL_CLOCK = new InjectionToken<() => number>('wall clock', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});
