import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { AdminFleetSettingsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { BranchContext } from '../../branches/branch-context';
import { FleetPreferences } from './fleet-preferences';
import { generalSettingsForm } from './general-settings-mapping';
import { GeneralSettingsPage } from './general-settings-page';

const branch = { id: '10000000-0000-4000-8000-000000000001', name: 'Sofia Fleet' };
const stored: AdminFleetSettingsFragment & { readonly __typename: 'FleetSettings' } = {
  __typename: 'FleetSettings',
  timeZone: 'Europe/Sofia',
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
};
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branch.id &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function root(fixture: ComponentFixture<GeneralSettingsPage>): HTMLElement {
  const value: unknown = fixture.nativeElement;
  if (!(value instanceof HTMLElement)) {
    throw new Error('Missing General settings page.');
  }
  return value;
}
function draft(fixture: ComponentFixture<GeneralSettingsPage>) {
  const form = fixture.debugElement
    .query(By.directive(FormGroupDirective))
    .injector.get(FormGroupDirective).form;
  form.get('name')?.setValue('North Fleet');
  form.get('name')?.markAsDirty();
  form.get('lowFuelPct')?.setValue(13);
  form.get('lowFuelPct')?.markAsDirty();
  return { ...generalSettingsForm(stored, 'North Fleet'), lowFuelPct: 13 };
}

describe('General settings independent service writes', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<GeneralSettingsPage>[] = [];
  const preferences = signal<AdminFleetSettingsFragment | null>(stored);
  const apply = vi.fn<(settings: AdminFleetSettingsFragment) => void>((settings) => {
    preferences.set(settings);
  });
  const refresh = vi.fn<BranchContext['refresh']>();
  const notice = vi.fn<MessageService['add']>();
  async function mount() {
    const fixture = TestBed.createComponent(GeneralSettingsPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', branch);
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    return fixture;
  }
  beforeEach(() => {
    preferences.set(stored);
    apply.mockImplementation((settings) => {
      preferences.set(settings);
    });
    refresh.mockReset();
    notice.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: FleetPreferences, useValue: { settings: preferences, apply } },
        { provide: BranchContext, useValue: { refresh } },
        { provide: MessageService, useValue: { add: notice } },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    document.querySelectorAll('.p-confirmdialog, .p-overlay-mask').forEach((element) => {
      element.remove();
    });
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it('hydrates the workspace preferences once and keeps unavailable notification switches disabled after saving', async () => {
    const fixture = await mount();
    http.expectNone('/graphql');
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    expect(form.get('criticalAlerts')?.disabled).toBe(true);
    expect(root(fixture).textContent).toContain('Notification delivery is not connected.');
    const save = fixture.componentInstance.save(generalSettingsForm(stored, branch.name));
    http
      .expectOne((request) => operation(request, 'AdminUpdateFleetSettings'))
      .flush({ data: { updateFleetSettings: stored } });
    await save;
    await fixture.whenStable();
    http.expectNone((request) => operation(request, 'AdminUpdateBranchName'));
    expect(form.get('criticalAlerts')?.disabled).toBe(true);
    expect(form.get('dailySummary')?.disabled).toBe(true);
    expect(notice).toHaveBeenCalledExactlyOnceWith({
      severity: 'success',
      summary: 'Settings saved.',
      life: 5000,
    });
  });

  it('waits for Fleet success before renaming Core and announces full success only after both settle', async () => {
    const fixture = await mount();
    const form = draft(fixture);
    const save = fixture.componentInstance.save(form);
    await fixture.componentInstance.save(form);
    expect(fixture.componentInstance.canLeave()).toBe(false);
    http.expectNone((request) => operation(request, 'AdminUpdateBranchName'));
    http
      .expectOne((request) => operation(request, 'AdminUpdateFleetSettings'))
      .flush({ data: { updateFleetSettings: { ...stored, lowFuelPct: 13 } } });
    await fixture.whenStable();
    expect(preferences()?.lowFuelPct).toBe(13);
    expect(notice).not.toHaveBeenCalled();
    expect(fixture.componentInstance.canLeave()).toBe(false);
    const rename = http.expectOne((request) => operation(request, 'AdminUpdateBranchName'));
    expect(rename.request.body).toMatchObject({
      variables: { id: branch.id, name: 'North Fleet' },
    });
    rename.flush({ data: { updateBranchName: { id: branch.id, name: 'North Fleet' } } });
    await save;
    await fixture.whenStable();
    expect(fixture.componentInstance.settings()?.name).toBe('North Fleet');
    expect(refresh).toHaveBeenCalledOnce();
    expect(notice).toHaveBeenCalledExactlyOnceWith({
      severity: 'success',
      summary: 'Settings saved.',
      life: 5000,
    });
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });

  it('retains a rejected name draft and discards it to the actual partially saved Fleet settings', async () => {
    const fixture = await mount();
    const save = fixture.componentInstance.save(draft(fixture));
    http
      .expectOne((request) => operation(request, 'AdminUpdateFleetSettings'))
      .flush({ data: { updateFleetSettings: { ...stored, lowFuelPct: 13 } } });
    await fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminUpdateBranchName'))
      .flush({
        errors: [
          {
            message: 'Name rejected.',
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldErrors: [{ path: 'name', message: 'Name rejected.' }],
            },
          },
        ],
      });
    await save;
    await fixture.whenStable();
    expect(fixture.componentInstance.partialSave()).toBe(true);
    expect(fixture.componentInstance.settings()?.name).toBe(branch.name);
    expect(preferences()?.lowFuelPct).toBe(13);
    const name = root(fixture).querySelector<HTMLInputElement>('#settings-name');
    expect(name?.value).toBe('North Fleet');
    expect(name?.getAttribute('aria-invalid')).toBe('true');
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(name);
    });
    expect(notice.mock.calls.map(([message]) => message.severity)).toEqual(['warn']);
    const discard = Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent.trim() === 'Discard',
    );
    if (!discard) {
      throw new Error('Missing Discard action.');
    }
    discard.click();
    await fixture.whenStable();
    expect(name?.value).toBe(branch.name);
    const form = fixture.debugElement
      .query(By.directive(FormGroupDirective))
      .injector.get(FormGroupDirective).form;
    expect(form.get('lowFuelPct')?.value).toBe(13);
    expect(form.pristine).toBe(true);
    expect(fixture.componentInstance.saveError()).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps a failed Fleet draft and never submits the Core rename', async () => {
    const fixture = await mount();
    const save = fixture.componentInstance.save(draft(fixture));
    http
      .expectOne((request) => operation(request, 'AdminUpdateFleetSettings'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await save;
    await fixture.whenStable();
    expect(root(fixture).querySelector<HTMLInputElement>('#settings-name')?.value).toBe(
      'North Fleet',
    );
    expect(fixture.componentInstance.settings()?.lowFuelPct).toBe(12);
    expect(fixture.componentInstance.partialSave()).toBe(false);
    http.expectNone((request) => operation(request, 'AdminUpdateBranchName'));
    expect(apply).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(notice).not.toHaveBeenCalled();
  });

  it('settles a retired Fleet write without starting the unsubmitted rename or publishing into a new workspace', async () => {
    const fixture = await mount();
    const save = fixture.componentInstance.save(draft(fixture));
    const write = http.expectOne((request) => operation(request, 'AdminUpdateFleetSettings'));
    fixture.destroy();
    expect(write.cancelled).toBe(false);
    write.flush({ data: { updateFleetSettings: { ...stored, lowFuelPct: 13 } } });
    await save;
    http.expectNone((request) => operation(request, 'AdminUpdateBranchName'));
    expect(apply).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(notice).not.toHaveBeenCalled();
  });
});
