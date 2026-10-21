import type { Params } from '@angular/router';
import type { Language } from '../../i18n/messages';

export interface FleetRecordLink {
  readonly commands: readonly unknown[];
  readonly queryParams?: Params;
  readonly fragment?: string | undefined;
}

/** Presentation links capture the same verified language and Branch as their mounted host. */
export interface FleetRecordLinks {
  readonly vehicle: (id: string) => FleetRecordLink;
  readonly driver: (id: string) => FleetRecordLink;
}

export function fleetRecordLinks(language: Language, branchId: string): FleetRecordLinks {
  const fleet = ['/', language, branchId, 'fleet'];
  return {
    vehicle: (id) => ({ commands: [...fleet, 'vehicles', id, 'overview'] }),
    driver: (id) => ({ commands: [...fleet, 'drivers', id] }),
  };
}

/** A return target is a Driver in this Branch, never an arbitrary URL or another list's filters. */
export function driverReturnId(value: string | null): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
