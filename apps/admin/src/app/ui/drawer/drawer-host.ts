import { inject } from '@angular/core';
import { ROUTER_OUTLET_DATA } from '@angular/router';

export interface DrawerSaved {
  readonly message: string;
  readonly recordId: string | null;
}

/** What a list or detail page offers the drawers in its outlet (`[routerOutletData]`). */
export interface DrawerHost {
  saved(event: DrawerSaved): void;
}

const noHost: DrawerHost = {
  saved: () => undefined,
};

function isDrawerHost(value: unknown): value is DrawerHost {
  return (
    typeof value === 'object' &&
    value !== null &&
    'saved' in value &&
    typeof value.saved === 'function'
  );
}

/** Reads ROUTER_OUTLET_DATA with a runtime check; returns a no-op host when absent (isolated stories). */
export function injectDrawerHost(): DrawerHost {
  const data = inject(ROUTER_OUTLET_DATA, { optional: true });
  const value: unknown = data?.();
  return isDrawerHost(value) ? value : noHost;
}
