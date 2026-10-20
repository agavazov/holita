import { Injectable } from '@angular/core';
import { BaseRouteReuseStrategy, type ActivatedRouteSnapshot } from '@angular/router';

function parameter(route: ActivatedRouteSnapshot, name: string): string | null {
  for (const ancestor of [...route.pathFromRoot].reverse()) {
    const value = ancestor.paramMap.get(name);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

/** Scoped lists survive drawer navigation; changing the scope or record creates a fresh client. */
@Injectable()
export class FleetRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(
    next: ActivatedRouteSnapshot,
    current: ActivatedRouteSnapshot,
  ): boolean {
    if (!super.shouldReuseRoute(next, current)) {
      return false;
    }
    if (
      next.data['resource'] !== 'vehicles' &&
      next.data['resource'] !== 'devices' &&
      next.data['resource'] !== 'groups' &&
      next.data['resource'] !== 'alerts' &&
      next.data['resource'] !== 'overview' &&
      next.data['resource'] !== 'trips' &&
      next.data['resource'] !== 'drivers' &&
      next.data['resource'] !== 'driver-scorecard' &&
      next.data['resource'] !== 'vehicle-profile' &&
      next.data['resource'] !== 'maintenance' &&
      next.data['resource'] !== 'general' &&
      next.data['drawer'] !== true
    ) {
      return true;
    }
    return (
      ['language', 'branchId', 'recordId'].every(
        (name) => parameter(next, name) === parameter(current, name),
      ) &&
      (next.data['drawer'] !== true || parameter(next, 'tab') === parameter(current, 'tab'))
    );
  }
}
