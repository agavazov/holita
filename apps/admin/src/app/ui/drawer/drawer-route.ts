import type { ActivatedRoute } from '@angular/router';

/** Route `data` of every drawer route (spec 4.1.1). */
export interface DrawerRouteData {
  readonly drawer: true;
  readonly mode: 'create' | 'edit' | 'view';
  /** Parameter holding this drawer's own record ID (edit and view modes). */
  readonly recordParam?: 'recordId' | 'vehicleId' | 'driverId';
  /** Parameter that fixes the vehicle of a record created here. */
  readonly fixedVehicleParam?: 'vehicleId';
}

const modes: readonly DrawerRouteData['mode'][] = ['create', 'edit', 'view'];
const recordParams: readonly NonNullable<DrawerRouteData['recordParam']>[] = [
  'recordId',
  'vehicleId',
  'driverId',
];

/** The drawer data of a route, checked at runtime; a misconfigured route throws. */
export function drawerRouteData(route: ActivatedRoute): DrawerRouteData {
  const data = route.snapshot.data;
  const mode = modes.find((candidate) => candidate === data['mode']);
  const recordParam = recordParams.find((candidate) => candidate === data['recordParam']);
  const fixed: unknown = data['fixedVehicleParam'];
  if (data['drawer'] !== true || !mode) throw new Error('Not a drawer route.');
  if (mode === 'create' && data['recordParam'] !== undefined)
    throw new Error('A create drawer has no record parameter.');
  if (mode !== 'create' && !recordParam)
    throw new Error('An edit or view drawer needs a record parameter.');
  if (fixed !== undefined && fixed !== 'vehicleId')
    throw new Error('Unknown fixed vehicle parameter.');
  return {
    drawer: true,
    mode,
    ...(recordParam ? { recordParam } : {}),
    ...(fixed === 'vehicleId' ? { fixedVehicleParam: fixed } : {}),
  };
}

/** One named route parameter from the drawer's own snapshot or its ancestors, nearest first. */
export function drawerParam(route: ActivatedRoute, name: string): string | null {
  for (const snapshot of [...route.snapshot.pathFromRoot].reverse()) {
    const value = snapshot.paramMap.get(name);
    if (value !== null) return value;
  }
  return null;
}
