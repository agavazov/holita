import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  type ActivatedRouteSnapshot,
  RouteReuseStrategy,
  Router,
  RouterOutlet,
  provideRouter,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { FleetRouteReuseStrategy } from './fleet-route-reuse';

@Component({
  selector: 'holita-route-reuse-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RouteHost {}

describe('Fleet route reuse', () => {
  const branchA = '10000000-0000-4000-8000-000000000001';
  const branchB = '10000000-0000-4000-8000-000000000002';
  const listRoute = ':branchId/fleet/vehicles';
  const editRoute = ':recordId/edit';
  const profileRoute = ':branchId/fleet/vehicles/:recordId/:tab';
  const profileTripRoute = 'trips/:recordId';
  const strategy = new FleetRouteReuseStrategy();
  let harness: RouterTestingHarness;

  function snapshot(path: string): ActivatedRouteSnapshot {
    let current: ActivatedRouteSnapshot | null = TestBed.inject(Router).routerState.snapshot.root;
    while (current) {
      if (current.routeConfig?.path === path) {
        return current;
      }
      current = current.firstChild;
    }
    throw new Error(`Missing active route ${path}.`);
  }

  function component(path: string): unknown {
    for (const element of harness.fixture.debugElement.queryAll(By.directive(RouterOutlet))) {
      const outlet = element.injector.get(RouterOutlet);
      if (outlet.isActivated && outlet.activatedRoute.snapshot.routeConfig?.path === path) {
        return outlet.component;
      }
    }
    throw new Error(`Missing active component ${path}.`);
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: ':language',
            component: RouteHost,
            children: [
              {
                path: profileRoute,
                canMatch: [
                  (_route, segments) =>
                    ['overview', 'trips', 'alerts', 'service'].includes(segments[4]?.path ?? ''),
                ],
                component: RouteHost,
                data: { resource: 'vehicle-profile' },
                children: [
                  {
                    path: profileTripRoute,
                    component: RouteHost,
                    data: { drawer: true, mode: 'view' },
                  },
                ],
              },
              {
                path: listRoute,
                component: RouteHost,
                data: { resource: 'vehicles' },
                children: [
                  { path: 'new', component: RouteHost, data: { drawer: true, mode: 'create' } },
                  { path: editRoute, component: RouteHost, data: { drawer: true, mode: 'edit' } },
                ],
              },
              {
                path: ':branchId/fleet/devices',
                component: RouteHost,
                data: { resource: 'devices' },
              },
              {
                path: ':branchId/fleet/overview',
                component: RouteHost,
                data: { resource: 'overview' },
              },
            ],
          },
        ]),
        { provide: RouteReuseStrategy, useClass: FleetRouteReuseStrategy },
      ],
    });
    harness = await RouterTestingHarness.create(`/en/${branchA}/fleet/vehicles`);
  });

  it('retains the list for query changes and opening or closing its drawer', async () => {
    const initial = snapshot(listRoute);
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles?search=truck&page=2`);
    expect(strategy.shouldReuseRoute(snapshot(listRoute), initial)).toBe(true);
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles/record-a/edit?search=truck`);
    expect(strategy.shouldReuseRoute(snapshot(listRoute), initial)).toBe(true);
    const edit = snapshot(editRoute);
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles/record-a/edit?search=another`);
    expect(strategy.shouldReuseRoute(snapshot(editRoute), edit)).toBe(true);
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles`);
    expect(strategy.shouldReuseRoute(snapshot(listRoute), initial)).toBe(true);
  });

  it('replaces the list when the Branch or language changes', async () => {
    const initial = snapshot(listRoute);
    await harness.navigateByUrl(`/en/${branchB}/fleet/vehicles`);
    expect(strategy.shouldReuseRoute(snapshot(listRoute), initial)).toBe(false);
    await harness.navigateByUrl(`/bg/${branchA}/fleet/vehicles`);
    expect(strategy.shouldReuseRoute(snapshot(listRoute), initial)).toBe(false);
  });

  it('replaces an editor on a record or inherited scope change', async () => {
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles/record-a/edit`);
    const initial = snapshot(editRoute);
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles/record-b/edit`);
    expect(strategy.shouldReuseRoute(snapshot(editRoute), initial)).toBe(false);
    await harness.navigateByUrl(`/en/${branchB}/fleet/vehicles/record-a/edit`);
    expect(strategy.shouldReuseRoute(snapshot(editRoute), initial)).toBe(false);
    await harness.navigateByUrl(`/bg/${branchA}/fleet/vehicles/record-a/edit`);
    expect(strategy.shouldReuseRoute(snapshot(editRoute), initial)).toBe(false);
  });

  it('recreates a related drawer on a profile tab change while retaining its profile parent', async () => {
    await harness.navigateByUrl(
      `/en/${branchA}/fleet/vehicles/vehicle-a/overview/trips/trip-a?search=kept`,
    );
    const profile = component(profileRoute);
    const drawer = component(profileTripRoute);
    const initialProfile = snapshot(profileRoute);
    const initialDrawer = snapshot(profileTripRoute);
    await harness.navigateByUrl(
      `/en/${branchA}/fleet/vehicles/vehicle-a/overview/trips/trip-a?search=changed`,
    );
    expect(component(profileRoute)).toBe(profile);
    expect(component(profileTripRoute)).toBe(drawer);
    await harness.navigateByUrl(
      `/en/${branchA}/fleet/vehicles/vehicle-a/trips/trips/trip-a?search=changed`,
    );
    expect(strategy.shouldReuseRoute(snapshot(profileRoute), initialProfile)).toBe(true);
    expect(strategy.shouldReuseRoute(snapshot(profileTripRoute), initialDrawer)).toBe(false);
    expect(component(profileRoute)).toBe(profile);
    expect(component(profileTripRoute)).not.toBe(drawer);
  });

  it('retains Overview on query changes and replaces it when the Branch or language changes', async () => {
    const overviewRoute = ':branchId/fleet/overview';
    await harness.navigateByUrl(`/en/${branchA}/fleet/overview`);
    const initial = snapshot(overviewRoute);
    await harness.navigateByUrl(`/en/${branchA}/fleet/overview?search=kept`);
    expect(strategy.shouldReuseRoute(snapshot(overviewRoute), initial)).toBe(true);
    await harness.navigateByUrl(`/en/${branchB}/fleet/overview`);
    expect(strategy.shouldReuseRoute(snapshot(overviewRoute), initial)).toBe(false);
    await harness.navigateByUrl(`/bg/${branchA}/fleet/overview`);
    expect(strategy.shouldReuseRoute(snapshot(overviewRoute), initial)).toBe(false);
  });

  it('keeps different route configurations separate and replaces Devices on scope changes', async () => {
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles/new`);
    const create = snapshot('new');
    await harness.navigateByUrl(`/en/${branchA}/fleet/vehicles/record-a/edit`);
    expect(strategy.shouldReuseRoute(snapshot(editRoute), create)).toBe(false);
    await harness.navigateByUrl(`/en/${branchA}/fleet/devices`);
    const devices = snapshot(':branchId/fleet/devices');
    await harness.navigateByUrl(`/bg/${branchB}/fleet/devices`);
    expect(strategy.shouldReuseRoute(snapshot(':branchId/fleet/devices'), devices)).toBe(false);
  });
});
