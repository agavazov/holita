import { InjectionToken, type Signal } from '@angular/core';
import type { ShellAccount } from './admin-topbar';

/** The workspace supplies account display data without coupling the shell to authentication. */
export const ACCOUNT_MENU_CONTEXT = new InjectionToken<Signal<ShellAccount | null>>(
  'Account menu context',
);
