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
import type { Language } from '../../../i18n/messages';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { AlertDetailPage } from './alert-detail-page';
import { alertsText } from './i18n/messages';
const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const id = '60000000-0000-4000-8000-000000000001';
const event = {
  __typename: 'FleetEvent',
  id,
  branchId: branchA,
  vehicleId: '20000000-0000-4000-8000-000000000001',
  vehicle: { id: '20000000-0000-4000-8000-000000000001', licensePlate: 'CB 1001 AX' },
  driverId: null,
  driver: null,
  tripId: null,
  occurredAt: '2026-10-18T06:00:00.000Z',
  kind: 'LOW_FUEL',
  severity: 'WARNING',
  alertStatus: 'OPEN',
  details: 'Fuel at 8%.',
  remark: 'Existing',
  acknowledgedAt: null,
  resolvedAt: null,
  address: null,
  measuredValue: 8,
  thresholdValue: 12,
  measurementUnit: 'PERCENT',
  troubleCode: null,
};
function snapshot(recordId = id, branchId = branchA) {
  const current = {
    data: { drawer: true, mode: 'view', recordParam: 'recordId' },
    paramMap: convertToParamMap({ recordId, branchId }),
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
    throw new Error('Missing alert drawer.');
  }
  return element;
}
function remark(): HTMLTextAreaElement {
  const input = dialog().querySelector<HTMLTextAreaElement>('#alert-remark');
  if (!input) {
    throw new Error('Missing alert remark.');
  }
  return input;
}
function type(value: string): void {
  const input = remark();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function clearOverlays(): void {
  document.querySelectorAll('.p-drawer, .p-overlay-mask').forEach((element) => {
    element.remove();
  });
}
describe('Live Alert detail workflow', () => {
  let http: HttpTestingController;
  const route = { snapshot: snapshot() };
  const saved = vi.fn<DrawerHost['saved']>();
  const navigate = vi.fn<Router['navigate']>();
  const outletHost = signal<DrawerHost>({ saved });
  const fixtures: ComponentFixture<AlertDetailPage>[] = [];
  const language = signal<Language>('en');
  async function mount(recordId = id, branchId = branchA) {
    route.snapshot = snapshot(recordId, branchId);
    const fixture = TestBed.createComponent(AlertDetailPage);
    fixtures.push(fixture);
    await fixture.whenStable();
    if (/^[0-9a-f-]{36}$/i.test(recordId)) {
      http
        .expectOne((request) => operation(request, 'AdminAlertsDataClock', branchId))
        .flush({
          data: {
            fleetDataClock: { asOf: null, businessDate: '2026-10-18', timeZone: 'Europe/Sofia' },
          },
        });
    }
    return fixture;
  }
  beforeEach(() => {
    language.set('en');
    outletHost.set({ saved });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
        { provide: ROUTER_OUTLET_DATA, useValue: outletHost },
        { provide: UI_LANGUAGE, useValue: language },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    saved.mockReset();
    navigate.mockReset().mockResolvedValue(true);
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
  it('links the Vehicle and assigned Driver within its captured scope without Alerts filters', async () => {
    const fixture = await mount();
    const driverId = '40000000-0000-4000-8000-000000000001';
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({
        data: {
          fleetEvent: {
            ...event,
            driverId,
            driver: { id: driverId, firstName: 'Elena', lastName: 'Petrova' },
          },
        },
      });
    await fixture.whenStable();
    const links = [...dialog().querySelectorAll('a')];
    const vehicle = links.find((link) => link.textContent.trim() === 'CB 1001 AX');
    const driver = links.find((link) => link.textContent.trim() === 'Elena Petrova');
    expect(vehicle?.getAttribute('href')).toBe(
      `/en/${branchA}/fleet/vehicles/${event.vehicleId}/overview`,
    );
    expect(driver?.getAttribute('href')).toBe(`/en/${branchA}/fleet/drivers/${driverId}`);
  });
  it('sends the captured expected status and explicit remark clearing, disables duplicate writes and closes once', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await fixture.whenStable();
    type(' ');
    const saving = fixture.componentInstance.apply('resolve', ' ');
    await fixture.componentInstance.apply('resolve', 'Ignored');
    const write = http.expectOne((request) => operation(request, 'AdminResolveAlert'));
    expect(write.request.body).toMatchObject({
      variables: { id, input: { expectedStatus: 'OPEN', remark: null } },
    });
    await fixture.whenStable();
    expect(remark().disabled).toBe(true);
    const vehicle = [...dialog().querySelectorAll('a')].find(
      (link) => link.textContent.trim() === 'CB 1001 AX',
    );
    expect(vehicle?.getAttribute('href')).toBeNull();
    expect(vehicle?.getAttribute('aria-disabled')).toBe('true');
    write.flush({
      data: { resolveFleetAlert: { ...event, alertStatus: 'RESOLVED', remark: null } },
    });
    await saving;
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith({ recordId: id, message: 'Alerts resolved: 1.' });
    expect(navigate).toHaveBeenCalledWith(
      ['/', 'en', branchA, 'fleet', 'alerts'],
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    expect(fixture.componentInstance.canLeave()).toBe(true);
  });
  it('returns to the owning profile tab after a transition and when opening its vehicle', async () => {
    const closeLink = ['/', 'en', branchA, 'fleet', 'vehicles', event.vehicleId, 'alerts'];
    outletHost.set({ saved, vehicleId: event.vehicleId, closeLink });
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await fixture.whenStable();
    const vehicle = [...dialog().querySelectorAll('a')].find(
      (link) => link.textContent.trim() === 'CB 1001 AX',
    );
    expect(vehicle?.getAttribute('href')).toBe(
      `/en/${branchA}/fleet/vehicles/${event.vehicleId}/alerts`,
    );
    fixture.componentInstance.openVehicle(event.vehicleId);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      closeLink,
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
    navigate.mockClear();
    const saving = fixture.componentInstance.apply('resolve', 'Resolved from the profile.');
    http
      .expectOne((request) => operation(request, 'AdminResolveAlert'))
      .flush({ data: { resolveFleetAlert: { ...event, alertStatus: 'RESOLVED' } } });
    await saving;
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith({ recordId: id, message: 'Alerts resolved: 1.' });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      closeLink,
      expect.objectContaining({ queryParamsHandling: 'preserve', preserveFragment: true }),
    );
  });
  it('rejects another vehicle alert without displaying it or allowing a transition', async () => {
    outletHost.set({ saved, vehicleId: '20000000-0000-4000-8000-000000000002' });
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('not-found');
    expect(fixture.componentInstance.record()).toBeNull();
    expect(fixture.componentInstance.alert()).toBeNull();
    expect(dialog().textContent).not.toContain('Fuel at 8%.');
    expect(dialog().textContent).not.toContain('CB 1001 AX');
    await fixture.componentInstance.apply('resolve', '');
    http.expectNone('/graphql');
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('keeps the draft and exposes a synchronous remark rejection with field focus', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await fixture.whenStable();
    type('Keep this draft.');
    const saving = fixture.componentInstance.apply('acknowledge', 'Keep this draft.');
    http
      .expectOne((request) => operation(request, 'AdminAcknowledgeAlert'))
      .flush({
        errors: [
          {
            message: 'Invalid input',
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldErrors: [{ path: 'remark', message: 'Rejected remark.' }],
            },
          },
        ],
      });
    await saving;
    await fixture.whenStable();
    expect(remark().value).toBe('Keep this draft.');
    expect(dialog().querySelector('#alert-remark-error')?.textContent).toContain(
      'The value is not valid.',
    );
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(remark());
    });
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it.each(['bg', 'en'] as const)(
    'refreshes a conflicted alert in %s and preserves its remark for an explicit retry',
    async (currentLanguage) => {
      language.set(currentLanguage);
      const fixture = await mount();
      http
        .expectOne((request) => operation(request, 'AdminAlert'))
        .flush({ data: { fleetEvent: event } });
      await fixture.whenStable();
      type('Investigate.');
      const saving = fixture.componentInstance.apply('resolve', 'Investigate.');
      const firstWrite = http.expectOne((request) => operation(request, 'AdminResolveAlert'));
      expect(firstWrite.request.body).toMatchObject({
        variables: { id, input: { expectedStatus: 'OPEN', remark: 'Investigate.' } },
      });
      firstWrite.flush({
        errors: [
          {
            message: 'The alert changed meanwhile.',
            extensions: { code: 'CONFLICT', requestId: 'conflict-request' },
          },
        ],
      });
      await vi.waitFor(() => {
        expect(fixture.componentInstance.state()).toBe('loading');
      });
      const refresh = http.expectOne((request) => operation(request, 'AdminAlert'));
      await fixture.whenStable();
      expect(fixture.componentInstance.busy()).toBe('resolve');
      expect(remark().disabled).toBe(true);
      const resolve = [...dialog().querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent.trim() === alertsText(currentLanguage).drawer.resolve,
      );
      expect(resolve?.disabled).toBe(true);
      await fixture.componentInstance.apply('resolve', 'Do not submit while refreshing.');
      http.expectNone((request) => operation(request, 'AdminResolveAlert'));
      expect(saved).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      refresh.flush({
        data: {
          fleetEvent: {
            ...event,
            alertStatus: 'ACKNOWLEDGED',
            remark: 'A different saved remark.',
          },
        },
      });
      await saving;
      await fixture.whenStable();
      expect(fixture.componentInstance.state()).toBe('ready');
      expect(fixture.componentInstance.alert()?.status).toBe('ACKNOWLEDGED');
      expect(remark().value).toBe('Investigate.');
      expect(remark().disabled).toBe(false);
      expect(dialog().textContent).toContain(alertsText(currentLanguage).drawer.conflictRetry);
      expect(dialog().textContent).toContain('conflict-request');
      expect(dialog().textContent).not.toContain('The alert changed meanwhile.');
      http.expectNone((request) => operation(request, 'AdminResolveAlert'));
      expect(saved).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();

      const retrying = fixture.componentInstance.apply('resolve', remark().value);
      const secondWrite = http.expectOne((request) => operation(request, 'AdminResolveAlert'));
      expect(secondWrite.request.body).toMatchObject({
        variables: { id, input: { expectedStatus: 'ACKNOWLEDGED', remark: 'Investigate.' } },
      });
      secondWrite.flush({
        data: {
          resolveFleetAlert: {
            ...event,
            alertStatus: 'RESOLVED',
            remark: 'Investigate.',
          },
        },
      });
      await retrying;
      await fixture.whenStable();
      expect(saved).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledTimes(1);
    },
  );
  it('shows only the fresh workflow action when the conflict read returns a resolved alert', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await fixture.whenStable();
    type('Keep this investigation.');
    const saving = fixture.componentInstance.apply('resolve', 'Keep this investigation.');
    http
      .expectOne((request) => operation(request, 'AdminResolveAlert'))
      .flush({ errors: [{ message: 'Changed.', extensions: { code: 'CONFLICT' } }] });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('loading');
    });
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: { ...event, alertStatus: 'RESOLVED', remark: 'Remote.' } } });
    await saving;
    await fixture.whenStable();
    expect(fixture.componentInstance.alert()?.status).toBe('RESOLVED');
    expect(remark().value).toBe('Keep this investigation.');
    const labels = [...dialog().querySelectorAll<HTMLButtonElement>('button')].map((button) =>
      button.textContent.trim(),
    );
    expect(labels).toContain(alertsText('en').drawer.reopen);
    expect(labels).not.toContain(alertsText('en').drawer.resolve);
    expect(labels).not.toContain(alertsText('en').drawer.acknowledge);
    http.expectNone('/graphql');
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('blocks stale actions after a failed conflict refresh and retains the draft through read retry', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await fixture.whenStable();
    type('Keep this remark.');
    const saving = fixture.componentInstance.apply('resolve', 'Keep this remark.');
    http
      .expectOne((request) => operation(request, 'AdminResolveAlert'))
      .flush({ errors: [{ message: 'Changed.', extensions: { code: 'CONFLICT' } }] });
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('loading');
    });
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({
        errors: [{ message: 'Refresh failed.', extensions: { code: 'SERVICE_UNAVAILABLE' } }],
      });
    await saving;
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.busy()).toBeNull();
    expect(fixture.componentInstance.record()?.alertStatus).toBe('OPEN');
    expect(remark().value).toBe('Keep this remark.');
    await fixture.componentInstance.apply('resolve', 'Do not submit stale status.');
    http.expectNone('/graphql');
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    const retry = [...dialog().querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent.trim() === 'Retry',
    );
    if (!retry) {
      throw new Error('Missing alert read retry.');
    }
    retry.click();
    await vi.waitFor(() => {
      expect(fixture.componentInstance.state()).toBe('loading');
    });
    const refresh = http.expectOne((request) => operation(request, 'AdminAlert'));
    await fixture.componentInstance.apply('resolve', 'Still not fresh.');
    http.expectNone((request) => operation(request, 'AdminResolveAlert'));
    refresh.flush({
      data: { fleetEvent: { ...event, alertStatus: 'ACKNOWLEDGED', remark: 'Remote.' } },
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('ready');
    expect(remark().value).toBe('Keep this remark.');
    expect(fixture.componentInstance.alert()?.status).toBe('ACKNOWLEDGED');
    expect(dialog().textContent).toContain(alertsText('en').drawer.conflictRetry);
    http.expectNone((request) => operation(request, 'AdminResolveAlert'));
    const retrying = fixture.componentInstance.apply('resolve', remark().value);
    const write = http.expectOne((request) => operation(request, 'AdminResolveAlert'));
    expect(write.request.body).toMatchObject({
      variables: { input: { expectedStatus: 'ACKNOWLEDGED', remark: 'Keep this remark.' } },
    });
    write.flush({ data: { resolveFleetAlert: { ...event, alertStatus: 'RESOLVED' } } });
    await retrying;
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledTimes(1);
  });
  it('reopens a resolved alert and keeps its drawer open with the new status', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: { ...event, alertStatus: 'RESOLVED' } } });
    await fixture.whenStable();
    const saving = fixture.componentInstance.apply('reopen', 'Investigate again.');
    const write = http.expectOne((request) => operation(request, 'AdminReopenAlert'));
    expect(write.request.body).toMatchObject({
      variables: { input: { expectedStatus: 'RESOLVED' } },
    });
    write.flush({ data: { reopenFleetAlert: { ...event, remark: 'Investigate again.' } } });
    await saving;
    await fixture.whenStable();
    expect(fixture.componentInstance.alert()?.status).toBe('OPEN');
    expect(saved).toHaveBeenCalledWith({ recordId: id, message: 'The alert was reopened.' });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('rejects a malformed ID and treats an informational event as a missing alert', async () => {
    const invalid = await mount('invalid');
    expect(invalid.componentInstance.state()).toBe('invalid-id');
    http.expectNone('/graphql');
    invalid.destroy();
    clearOverlays();
    const informational = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: { ...event, alertStatus: null } } });
    await informational.whenStable();
    expect(informational.componentInstance.state()).toBe('not-found');
    await informational.componentInstance.apply('resolve', '');
    http.expectNone('/graphql');
  });
  it('does not publish a retired transition into a new Branch drawer', async () => {
    const old = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await old.whenStable();
    const saving = old.componentInstance.apply('resolve', 'Submitted A');
    const write = http.expectOne((request) => operation(request, 'AdminResolveAlert'));
    old.destroy();
    clearOverlays();
    const current = await mount(id, branchB);
    http
      .expectOne((request) => operation(request, 'AdminAlert', branchB))
      .flush({ data: { fleetEvent: { ...event, branchId: branchB } } });
    await current.whenStable();
    type('Current B');
    expect(write.cancelled).toBe(false);
    write.flush({ data: { resolveFleetAlert: { ...event, alertStatus: 'RESOLVED' } } });
    await saving;
    await current.whenStable();
    expect(remark().value).toBe('Current B');
    expect(saved).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('keeps an unsaved remark after rejecting the shared leave confirmation', async () => {
    const fixture = await mount();
    http
      .expectOne((request) => operation(request, 'AdminAlert'))
      .flush({ data: { fleetEvent: event } });
    await fixture.whenStable();
    type('Unsaved remark');
    const leaving = fixture.componentInstance.canLeave();
    await vi.waitFor(() => {
      expect(document.querySelector('.p-confirmdialog-reject-button')).not.toBeNull();
    });
    document.querySelector<HTMLButtonElement>('.p-confirmdialog-reject-button')?.click();
    expect(await leaving).toBe(false);
    expect(remark().value).toBe('Unsaved remark');
    expect(navigate).not.toHaveBeenCalled();
  });
});
