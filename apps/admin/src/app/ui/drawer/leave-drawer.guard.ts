import type { CanDeactivateFn } from '@angular/router';

export interface LeavableDrawer {
  canLeave(): boolean | Promise<boolean>;
}

/** Drawer routes can be active without a mounted component (signed out, Fleet disabled,
 * unknown Branch, Branch discovery hiding the outlet); only a mounted drawer can block. */
export const leaveDrawer: CanDeactivateFn<LeavableDrawer | null> = (component) =>
  component?.canLeave() ?? true;
