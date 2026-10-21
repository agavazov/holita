import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  ROUTER_OUTLET_DATA,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { DemoSession } from '../../../core/auth/demo-session';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { VehicleGroupEditorPage } from './vehicle-group-editor-page';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const groupId = '30000000-0000-4000-8000-000000000001';
const group = {
  __typename: 'FleetVehicleGroup',
  id: groupId,
  branchId: branchA,
  name: 'Regional',
  description: 'First line\nSecond line',
  colorToken: 'C2',
  vehicleCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
function snapshot(mode: 'create' | 'edit', id: string, branchId: string) {
  const current = {
    data: { drawer: true, mode, ...(mode === 'edit' ? { recordParam: 'recordId' } : {}) },
    paramMap: convertToParamMap({ branchId, ...(mode === 'edit' ? { recordId: id } : {}) }),
  };
  return { ...current, pathFromRoot: [current] };
}
function operation(request: HttpRequest<unknown>, name: string, branchId = branchA): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branchId &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function dialog(): HTMLElement {
  const element = Array.from(document.querySelectorAll<HTMLElement>('.p-drawer[role="dialog"]')).at(
    -1,
  );
  if (!element) {
    throw new Error('Missing current group drawer.');
  }
  return element;
}
function field(name: 'name' | 'description'): HTMLInputElement | HTMLTextAreaElement {
  const element = dialog().querySelector<HTMLInputElement | HTMLTextAreaElement>(`#group-${name}`);
  if (!element) {
    throw new Error(`Missing group ${name} input.`);
  }
  return element;
}
function type(name: 'name' | 'description', value: string): void {
  const input = field(name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function clearOverlays(): void {
  document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
    element.remove();
  });
}

describe('Live Vehicle group editor', () => {
  let http: HttpTestingController;
  const navigate = vi.fn<Router['navigate']>();
  const saved = vi.fn<DrawerHost['saved']>();
  const host: DrawerHost = { saved };
  const route = { snapshot: snapshot('create', groupId, branchA) };
  const fixtures: ComponentFixture<VehicleGroupEditorPage>[] = [];
  async function mount(mode: 'create' | 'edit' = 'create', id = groupId, branchId = branchA) {
    route.snapshot = snapshot(mode, id, branchId);
    const fixture = TestBed.createComponent(VehicleGroupEditorPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    return fixture;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: ROUTER_OUTLET_DATA, useValue: signal(host) },
        { provide: UI_LANGUAGE, useValue: signal('en') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    navigate.mockReset().mockResolvedValue(true);
    saved.mockReset();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    clearOverlays();
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('accepts the backend text bounds and focuses invalid input without a write', async () => {
    const fixture = await mount();
    type('name', '😀'.repeat(65));
    dialog()
      .querySelector<HTMLFormElement>('#group-form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(field('name').getAttribute('aria-invalid')).toBe('true');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field('name'));
    });
    type('name', '😀'.repeat(64));
    type('description', 'd'.repeat(500));
    dialog()
      .querySelector<HTMLFormElement>('#group-form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const write = http.expectOne((request) => operation(request, 'AdminCreateVehicleGroup'));
    expect(write.request.body).toMatchObject({
      variables: { input: { name: '😀'.repeat(64), description: 'd'.repeat(500) } },
    });
    write.flush({ data: { createFleetVehicleGroup: group } });
    await fixture.whenStable();
  });

  it('disables a captured create and closes to the absolute list with its URL context', async () => {
    const fixture = await mount();
    type('name', ' Created ');
    const saving = fixture.componentInstance.save({
      name: ' Created ',
      description: ' ',
      slot: 'c8',
    });
    await fixture.componentInstance.save({ name: 'Ignored', description: '', slot: 'c1' });
    const write = http.expectOne((request) => operation(request, 'AdminCreateVehicleGroup'));
    expect(write.request.body).toMatchObject({
      variables: { input: { name: 'Created', description: null, colorToken: 'C8' } },
    });
    await fixture.whenStable();
    expect(field('name').disabled).toBe(true);
    write.flush({ data: { createFleetVehicleGroup: { ...group, name: 'Created' } } });
    await saving;
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith({ recordId: groupId, message: 'Created was created.' });
    expect(navigate).toHaveBeenCalledWith(
      ['/', 'en', branchA, 'fleet', 'settings', 'groups'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });

  it('retains an edited draft and focuses a synchronous server rejection', async () => {
    const fixture = await mount('edit');
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroup'))
      .flush({ data: { fleetVehicleGroup: group } });
    await fixture.whenStable();
    expect(field('description').value).toBe('First line\nSecond line');
    type('name', 'Duplicate');
    type('description', 'Retain this draft.');
    const saving = fixture.componentInstance.save({
      name: 'Duplicate',
      description: 'Retain this draft.',
      slot: 'c2',
    });
    http
      .expectOne((request) => operation(request, 'AdminUpdateVehicleGroup'))
      .flush({
        errors: [
          {
            message: 'Invalid input',
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldErrors: [
                {
                  path: 'name',
                  message: 'A vehicle group with this name already exists in this branch.',
                  code: 'ALREADY_EXISTS',
                },
              ],
            },
          },
        ],
      });
    await saving;
    await fixture.whenStable();
    expect(field('name').value).toBe('Duplicate');
    expect(field('description').value).toBe('Retain this draft.');
    expect(dialog().querySelector('#group-name-error')?.textContent).toContain('already exists');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(field('name'));
    });
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs and a missing record without enabling a write', async () => {
    const invalid = await mount('edit', 'invalid');
    expect(invalid.componentInstance.state()).toBe('invalid-id');
    await invalid.componentInstance.save({ name: 'No write', description: '', slot: 'c1' });
    http.expectNone('/graphql');
    invalid.destroy();
    clearOverlays();
    const missing = await mount('edit');
    http
      .expectOne((request) => operation(request, 'AdminVehicleGroup'))
      .flush({
        errors: [{ message: 'Vehicle group not found', extensions: { code: 'NOT_FOUND' } }],
      });
    await missing.whenStable();
    expect(missing.componentInstance.state()).toBe('not-found');
    expect(dialog().querySelector('.route-drawer__content')?.hasAttribute('hidden')).toBe(true);
    await missing.componentInstance.save({ name: 'No write', description: '', slot: 'c1' });
    http.expectNone('/graphql');
  });

  it('keeps a dirty group draft when the shared leave confirmation is rejected', async () => {
    const fixture = await mount();
    type('name', 'Unsaved group');
    const leaving = fixture.componentInstance.canLeave();
    await vi.waitFor(() => {
      expect(document.querySelector('.p-confirmdialog-reject-button')).not.toBeNull();
    });
    document.querySelector<HTMLButtonElement>('.p-confirmdialog-reject-button')?.click();
    expect(await leaving).toBe(false);
    expect(field('name').value).toBe('Unsaved group');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'isolates a retired create result (success=%s) from a new Branch',
    async (success) => {
      const old = await mount();
      const saving = old.componentInstance.save({
        name: 'Submitted A',
        description: '',
        slot: 'c1',
      });
      const write = http.expectOne((request) => operation(request, 'AdminCreateVehicleGroup'));
      old.destroy();
      clearOverlays();
      const current = await mount('create', groupId, branchB);
      type('name', 'Current draft');
      expect(write.cancelled).toBe(false);
      write.flush(
        success
          ? { data: { createFleetVehicleGroup: group } }
          : { errors: [{ message: 'Late failure' }] },
      );
      await saving;
      await current.whenStable();
      expect(field('name').value).toBe('Current draft');
      expect(current.componentInstance.saveError()).toBeNull();
      expect(saved).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});
