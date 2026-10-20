import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { AdminDriverDetailsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { WALL_CLOCK } from '../../../ui/clock';
import { DriversPage } from './drivers-page';

const branch = '10000000-0000-4000-8000-000000000001';
const firstId = '20000000-0000-4000-8000-000000000001';
const secondId = '20000000-0000-4000-8000-000000000002';
function record(id = firstId): AdminDriverDetailsFragment & { readonly __typename: 'FleetDriver' } {
  return {
    __typename: 'FleetDriver',
    id,
    branchId: branch,
    firstName: id === firstId ? 'Elena' : 'Martin',
    lastName: 'Petrov',
    employeeNumber: null,
    identificationKey: null,
    phone: null,
    email: null,
    licenseNumber: null,
    licenseCategories: [],
    licenseExpiresOn: null,
    tachographCardNumber: null,
    tachographCardExpiresOn: null,
    status: 'ACTIVE',
    notes: null,
    vehicles: [],
    documentStatus: 'NOT_RECORDED',
    distance30dKm: 0,
    tripCount30d: 0,
    drivingScore30d: null,
    maneuversPer100Km30d: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
function list(items: AdminDriverDetailsFragment[]) {
  return {
    data: {
      fleetDrivers: {
        __typename: 'FleetDriverPage',
        items,
        total: items.length,
        offset: 0,
        limit: 20,
      },
    },
  };
}
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    request.headers.get('x-branch-id') === branch &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

describe('Drivers live list actions', () => {
  let http: HttpTestingController;
  const notice = vi.fn<MessageService['add']>();
  const fixtures: ComponentFixture<DriversPage>[] = [];
  function flushSummary(businessDate = '2026-10-18'): void {
    http
      .expectOne((request) => operation(request, 'AdminDriverSummary'))
      .flush({
        data: {
          fleetDataClock: { __typename: 'FleetDataClock', businessDate },
          fleetDriverSummary: {
            dataAsOf: null,
            active: 2,
            onLeave: 0,
            documentsExpiring: 0,
            averageDrivingScore: null,
            distance30dKm: 0,
          },
        },
      });
  }
  async function mount(items = [record(), record(secondId)], businessDate = '2026-10-18') {
    const fixture = TestBed.createComponent(DriversPage);
    fixtures.push(fixture);
    fixture.componentRef.setInput('branch', { id: branch, name: 'Test fleet' });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    flushSummary(businessDate);
    http.expectOne((request) => operation(request, 'AdminDrivers')).flush(list(items));
    await fixture.whenStable();
    fixture.componentInstance.selected.set([
      { id: firstId, label: 'Elena Petrov', unavailable: [] },
      { id: secondId, label: 'Martin Petrov', unavailable: [] },
    ]);
    return fixture;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        { provide: UI_LANGUAGE, useValue: signal('en') },
        { provide: WALL_CLOCK, useValue: () => Date.parse('2035-01-01T00:00:00.000Z') },
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'driver-list-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
    notice.mockReset();
    vi.spyOn(TestBed.inject(MessageService), 'add').mockImplementation(notice);
  });

  it('uses the server business date for document badges even without telemetry and with a different browser date', async () => {
    const fixture = await mount([
      { ...record(), licenseExpiresOn: '2026-11-17', documentStatus: 'EXPIRING' },
    ]);
    expect(fixture.componentInstance.summary()?.dataAsOf).toBeNull();
    expect(fixture.componentInstance.businessDate()).toBe('2026-10-18');
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Drivers list.');
    }
    expect(element.textContent).toContain('Expires in 30 d');
    expect(element.textContent).not.toContain('Expired');
  });
  it('keeps document dates but suppresses expiry classification when a refreshed business date is unavailable', async () => {
    const fixture = await mount([
      { ...record(), licenseExpiresOn: '2000-01-01', documentStatus: 'EXPIRED' },
    ]);
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Drivers list.');
    }
    expect(element.textContent).toContain('Expired');
    fixture.componentInstance.refreshSummary();
    http
      .expectOne((request) => operation(request, 'AdminDriverSummary'))
      .flush('Offline', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.businessDate()).toBeNull();
    expect(element.textContent).not.toContain('Expired');
    expect(element.textContent).toContain('Document expiry status is unavailable');
    expect(element.textContent).toContain('1 Jan 2000');
  });
  afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
      fixture.destroy();
    }
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  it.each(['delete', 'deactivate'] as const)(
    'runs one %s batch, keeps failed rows selected and retries only those IDs',
    async (action) => {
      const fixture = await mount();
      const page = fixture.componentInstance;
      const running = page.run({ action, ids: [firstId, secondId] });
      await page.run({ action, ids: [firstId] });
      const name = action === 'delete' ? 'AdminDeleteDrivers' : 'AdminDeactivateDrivers';
      const field = action === 'delete' ? 'deleteFleetDrivers' : 'deactivateFleetDrivers';
      const write = http.expectOne((request) => operation(request, name));
      expect(write.request.body).toMatchObject({ variables: { ids: [firstId, secondId] } });
      write.flush({
        data: {
          [field]: {
            succeededIds: [firstId],
            failures: [{ id: secondId, code: 'CONFLICT', message: 'Driver has history.' }],
          },
        },
      });
      await running;
      http
        .expectOne((request) => operation(request, 'AdminDrivers'))
        .flush(
          list(
            action === 'delete'
              ? [record(secondId)]
              : [{ ...record(), status: 'INACTIVE' }, record(secondId)],
          ),
        );
      flushSummary();
      await fixture.whenStable();
      expect(page.selected().map((row) => row.id)).toEqual([secondId]);
      expect(notice).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: 'warn',
          sticky: true,
          detail: 'Martin Petrov: Driver has history.',
        }),
      );
      const retry = page.run({ action, ids: page.selected().map((row) => row.id) });
      const retryWrite = http.expectOne((request) => operation(request, name));
      expect(retryWrite.request.body).toMatchObject({ variables: { ids: [secondId] } });
      retryWrite.flush({ data: { [field]: { succeededIds: [secondId], failures: [] } } });
      await retry;
      http
        .expectOne((request) => operation(request, 'AdminDrivers'))
        .flush(
          list(
            action === 'delete'
              ? []
              : [
                  { ...record(), status: 'INACTIVE' },
                  { ...record(secondId), status: 'INACTIVE' },
                ],
          ),
        );
      flushSummary();
      await fixture.whenStable();
      expect(page.selected()).toEqual([]);
    },
  );

  it('retains all selections after a failed transport and exposes the request diagnostic', async () => {
    const fixture = await mount();
    const page = fixture.componentInstance;
    const running = page.run({ action: 'delete', ids: [firstId, secondId] });
    http
      .expectOne((request) => operation(request, 'AdminDeleteDrivers'))
      .flush({
        errors: [
          {
            message: 'Deletion unavailable',
            extensions: { requestId: 'driver-delete-failure' },
          },
        ],
      });
    await running;
    expect(page.selected().map((row) => row.id)).toEqual([firstId, secondId]);
    expect(page.page()?.items).toHaveLength(2);
    expect(notice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Deletion unavailable (driver-delete-failure)',
      }),
    );
    http.expectNone('/graphql');
  });
});
