import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { drawerParam, drawerRouteData } from './drawer-route';

@Component({ selector: 'holita-test-page', imports: [RouterOutlet], template: '<router-outlet />' })
class TestPage {}

@Component({ selector: 'holita-test-drawer', template: '' })
class TestDrawer {
  readonly route = inject(ActivatedRoute);
}

async function drawerAt(url: string): Promise<ActivatedRoute> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'vehicles/:vehicleId',
          component: TestPage,
          children: [
            {
              path: 'service/new',
              component: TestDrawer,
              data: { drawer: true, mode: 'create', fixedVehicleParam: 'vehicleId' },
            },
            {
              path: 'service/:recordId/edit',
              component: TestDrawer,
              data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
            },
            { path: 'broken', component: TestDrawer, data: { drawer: true, mode: 'edit' } },
            { path: 'plain', component: TestDrawer },
          ],
        },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const drawer: unknown = harness.fixture.debugElement.query(
    (element) => element.componentInstance instanceof TestDrawer,
  ).componentInstance;
  if (!(drawer instanceof TestDrawer)) {
    throw new Error('Missing drawer.');
  }
  return drawer.route;
}

describe('drawer route data', () => {
  it('reads create drawers with a fixed vehicle and never a record ID', async () => {
    const route = await drawerAt('/vehicles/v-1/service/new');
    expect(drawerRouteData(route)).toEqual({
      drawer: true,
      mode: 'create',
      fixedVehicleParam: 'vehicleId',
    });
    expect(drawerParam(route, 'vehicleId')).toBe('v-1');
    expect(drawerParam(route, 'recordId')).toBeNull();
  });

  it('reads the drawer’s own record parameter before ancestors', async () => {
    const route = await drawerAt('/vehicles/v-1/service/t-9/edit');
    expect(drawerRouteData(route)).toEqual({ drawer: true, mode: 'edit', recordParam: 'recordId' });
    expect(drawerParam(route, 'recordId')).toBe('t-9');
    expect(drawerParam(route, 'vehicleId')).toBe('v-1');
  });

  it('throws for misconfigured routes', async () => {
    const broken = await drawerAt('/vehicles/v-1/broken');
    expect(() => drawerRouteData(broken)).toThrow('needs a record parameter');
    expect(() => drawerRouteData(TestBed.inject(ActivatedRoute))).toThrow('Not a drawer route.');
  });
});
