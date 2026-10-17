import { DemoSession } from '../../../core/auth/demo-session';
import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ApolloClient } from '@apollo/client/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import type { AdminDeviceFragment } from '../../../../generated/graphql/operations';
import { routes } from '../../../app.routes';
import { graphqlOptions } from '../../../core/graphql/graphql-options';
import { DevicesPage } from './devices-page';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const path = `/en/${branchA}/fleet/devices`;
const branches = [
  { id: branchA, name: 'Discordia' },
  { id: branchB, name: 'Sandbox' },
];
const alpha: AdminDeviceFragment = {
  id: '20000000-0000-4000-8000-000000000001',
  branchId: branchA,
  imei: 'Alpha',
  vehicleId: '30000000-0000-4000-8000-000000000001',
  vehicle: { id: '30000000-0000-4000-8000-000000000001', licensePlate: 'CA1234AB' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const beta: AdminDeviceFragment = {
  ...alpha,
  id: '20000000-0000-4000-8000-000000000002',
  imei: 'Beta',
};
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
function list(
  items: AdminDeviceFragment[] = [alpha, beta],
  total = items.length,
  offset = 0,
  limit = 20,
) {
  return {
    data: {
      fleetDevices: {
        __typename: 'FleetDevicePage',
        items: items.map((device) => ({ ...device, __typename: 'FleetDevice' })),
        total,
        offset,
        limit,
      },
    },
  };
}
function deletion(device: AdminDeviceFragment) {
  return { data: { deleteFleetDevice: { ...device, __typename: 'FleetDevice' } } };
}
function page(harness: RouterTestingHarness): DevicesPage {
  const component: unknown = harness.routeDebugElement?.query(
    By.directive(DevicesPage),
  ).componentInstance;
  if (!(component instanceof DevicesPage)) throw new Error('Missing Devices page.');
  return component;
}
function click(harness: RouterTestingHarness, label: string): void {
  const button = [
    ...(harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('button') ?? []),
  ].find(
    (element) =>
      element.getAttribute('aria-label') === label || element.textContent.trim() === label,
  );
  if (!button) throw new Error('Missing button: ' + label);
  button.click();
}
function select(harness: RouterTestingHarness, label: string): void {
  const input = [
    ...(harness.routeNativeElement?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ??
      []),
  ].find((element) => element.getAttribute('aria-label') === label);
  if (!input) throw new Error('Missing checkbox: ' + label);
  input.click();
}
async function decide(accept: boolean): Promise<void> {
  await vi.waitFor(() => {
    expect(document.querySelector('.p-confirmdialog')).not.toBeNull();
  });
  const button = document.querySelector<HTMLButtonElement>(
    accept ? '.p-confirmdialog-accept-button' : '.p-confirmdialog-reject-button',
  );
  if (!button) throw new Error('Missing confirmation button.');
  button.click();
  await vi.waitFor(() => {
    expect(document.querySelector('.p-confirmdialog')).toBeNull();
  });
}

describe('Devices deletion and selection lifecycle', () => {
  let http: HttpTestingController;
  let router: Router;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => graphqlOptions(inject(HttpLink), '/graphql')),
      ],
    });
    TestBed.inject(DemoSession).start({
      token: 'test-demo-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'RentalSofia' },
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });
  afterEach(() => {
    try {
      http.verify({ ignoreCancelled: true });
    } finally {
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
    }
  });
  async function nextRequest(name = 'AdminDevices') {
    return vi.waitFor(() => http.expectOne((request) => operation(request, name)));
  }
  async function mount(
    query = '',
    items = [alpha, beta],
    total = items.length,
    offset = 0,
    limit = 20,
  ) {
    const harness = await RouterTestingHarness.create(path + query);
    (await nextRequest('AdminBranches')).flush({ data: { branches } });
    await harness.fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminDevices'))
      .flush(list(items, total, offset, limit));
    await harness.fixture.whenStable();
    return harness;
  }

  it('requires confirmation and Cancel submits nothing', async () => {
    const harness = await mount();
    click(harness, 'Delete Alpha');
    await harness.fixture.whenStable();
    expect(document.querySelector('.p-confirmdialog')?.textContent).toContain(
      'Permanently delete device “Alpha”?',
    );
    http.expectNone('/graphql');
    await decide(false);
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('Alpha');
    http.expectNone('/graphql');
  });

  it('selects only loaded rows, retains selection on refresh and clears it on list-query changes', async () => {
    const harness = await mount('', [alpha, beta], 40);
    select(harness, 'Select devices on this page');
    await harness.fixture.whenStable();
    expect(
      page(harness)
        .selected()
        .map((device) => device.id),
    ).toEqual([alpha.id, beta.id]);
    page(harness).refresh();
    (await nextRequest()).flush(list([beta], 39));
    await harness.fixture.whenStable();
    expect(
      page(harness)
        .selected()
        .map((device) => device.id),
    ).toEqual([beta.id]);
    await router.navigateByUrl(path + '?page=2');
    await harness.fixture.whenStable();
    expect(page(harness).selected()).toEqual([]);
    (await nextRequest()).flush(list([alpha], 39, 20));
    await harness.fixture.whenStable();
    select(harness, 'Select Alpha');
    await router.navigateByUrl(path + '?search=Beta');
    await harness.fixture.whenStable();
    expect(page(harness).selected()).toEqual([]);
    (await nextRequest()).flush(list([beta]));
    await harness.fixture.whenStable();
  });

  it('deletes sequentially, reports partial failures with request IDs and retries only failed rows', async () => {
    const harness = await mount();
    select(harness, 'Select devices on this page');
    await harness.fixture.whenStable();
    click(harness, 'Delete selected devices');
    await decide(true);
    const first = await nextRequest('AdminDeleteDevice');
    expect(first.request.body).toMatchObject({ variables: { id: alpha.id } });
    expect(first.request.headers.get('x-branch-id')).toBe(branchA);
    expect(first.request.headers.get('Accept-Language')).toBe('en');
    click(harness, 'Delete selected devices');
    http.expectNone('/graphql');
    expect(
      harness.routeNativeElement?.querySelector<HTMLInputElement>('input[type="checkbox"]')
        ?.disabled,
    ).toBe(true);
    first.flush(deletion(alpha));
    await harness.fixture.whenStable();
    const second = await nextRequest('AdminDeleteDevice');
    expect(second.request.body).toMatchObject({ variables: { id: beta.id } });
    expect(second.request.headers.get('x-request-id')).not.toBe(
      first.request.headers.get('x-request-id'),
    );
    http.expectNone('/graphql');
    second.flush(
      { statusCode: 503 },
      { status: 503, statusText: 'Unavailable', headers: { 'x-request-id': 'failed-delete-id' } },
    );
    await harness.fixture.whenStable();
    (await nextRequest()).flush(list([beta]));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Deleted devices: 1. Failed devices: 1.',
    );
    expect(harness.routeNativeElement?.textContent).toContain(
      'Beta: Could not reach the gateway. (failed-delete-id)',
    );
    expect(
      page(harness)
        .selected()
        .map((device) => device.id),
    ).toEqual([beta.id]);
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).not.toContain('Alpha');
    click(harness, 'Delete selected devices');
    await decide(true);
    const retry = await nextRequest('AdminDeleteDevice');
    expect(retry.request.body).toMatchObject({ variables: { id: beta.id } });
    retry.flush(deletion(beta));
    await harness.fixture.whenStable();
    (await nextRequest()).flush(list([]));
    await harness.fixture.whenStable();
    expect(page(harness).selected()).toEqual([]);
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain(
      'No devices yet.',
    );
    expect(harness.routeNativeElement?.textContent).not.toContain('failed-delete-id');
    http.expectNone('/graphql');
  });

  it('corrects an emptied last page from the server total and preserves the batch summary and URL context', async () => {
    const harness = await mount('?page=2&pageSize=10&keep=yes#rows', [alpha], 11, 10, 10);
    click(harness, 'Delete Alpha');
    await decide(true);
    (await nextRequest('AdminDeleteDevice')).flush(deletion(alpha));
    await harness.fixture.whenStable();
    const refresh = await nextRequest();
    expect(refresh.request.body).toMatchObject({ variables: { offset: 10, limit: 10 } });
    refresh.flush(list([], 10, 10, 10));
    await harness.fixture.whenStable();
    expect(router.url).toBe(path + '?pageSize=10&keep=yes#rows');
    (await nextRequest()).flush(list([beta], 10, 0, 10));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Deleted devices: 1.');
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('Beta');
    expect(page(harness).deleting()).toBe(false);
    http.expectNone('/graphql');
  });

  it('does not resurrect confirmed deletions when list refresh fails', async () => {
    const harness = await mount();
    click(harness, 'Delete Alpha');
    await decide(true);
    (await nextRequest('AdminDeleteDevice')).flush(deletion(alpha));
    await harness.fixture.whenStable();
    const refresh = await nextRequest();
    refresh.error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).not.toContain('Alpha');
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).toContain('Beta');
    expect(harness.routeNativeElement?.textContent).toContain('Deleted devices: 1.');
    expect(harness.routeNativeElement?.textContent).toContain(
      refresh.request.headers.get('x-request-id'),
    );
    click(harness, 'Retry');
    (await nextRequest()).flush(list([beta]));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('tbody')?.textContent).not.toContain('Alpha');
  });

  it.each(['branch', 'language', 'query', 'editor'])(
    'stops the unsent batch after %s navigation and retires late success',
    async (destination) => {
      const harness = await mount();
      const stop = vi.spyOn(ApolloClient.prototype, 'stop');
      const submitted = vi.spyOn(page(harness).api, 'delete');
      select(harness, 'Select devices on this page');
      await harness.fixture.whenStable();
      click(harness, 'Delete selected devices');
      await decide(true);
      const write = await nextRequest('AdminDeleteDevice');
      const url =
        destination === 'branch'
          ? path.replace(branchA, branchB)
          : destination === 'language'
            ? path.replace('/en/', '/bg/')
            : destination === 'query'
              ? path + '?search=Beta'
              : path + `/${beta.id}/edit`;
      await router.navigateByUrl(url);
      await harness.fixture.whenStable();
      expect(write.cancelled).toBe(false);
      expect(stop).toHaveBeenCalledTimes(destination === 'language' ? 1 : 0);
      if (destination === 'language') {
        (await nextRequest('AdminBranches')).flush({ data: { branches } });
        await harness.fixture.whenStable();
      }
      if (destination === 'editor') {
        http
          .expectOne((request) => operation(request, 'AdminDevice'))
          .flush({ data: { fleetDevice: { ...beta, __typename: 'FleetDevice' } } });
        await harness.fixture.whenStable();
        http
          .expectOne((request) => operation(request, 'AdminDeviceVehicles'))
          .flush({ data: { fleetVehicles: { items: [beta.vehicle], total: 1 } } });
      } else {
        const current = { ...beta, branchId: destination === 'branch' ? branchB : branchA };
        (await nextRequest()).flush(list([current]));
      }
      await harness.fixture.whenStable();
      const before = harness.routeNativeElement?.textContent;
      if (destination === 'query') {
        select(harness, 'Select Beta');
        await harness.fixture.whenStable();
      }
      write.flush(deletion(alpha));
      const completion: unknown = submitted.mock.results[0]?.value;
      if (!(completion instanceof Promise)) throw new Error('Missing submitted deletion.');
      await completion;
      await harness.fixture.whenStable();
      expect(router.url).toBe(url);
      if (destination !== 'query') expect(harness.routeNativeElement?.textContent).toBe(before);
      else
        expect(
          page(harness)
            .selected()
            .map((device) => device.id),
        ).toEqual([beta.id]);
      expect(harness.routeNativeElement?.textContent).not.toContain('Deleted devices:');
      expect(harness.routeNativeElement?.textContent).not.toContain('Failed devices:');
      if (destination === 'query') expect(stop).not.toHaveBeenCalled();
      else expect(stop).toHaveBeenCalledTimes(destination === 'language' ? 2 : 1);
      http.expectNone('/graphql');
    },
  );

  it('suppresses a retired delete failure and stops the remaining batch', async () => {
    const harness = await mount();
    const submitted = vi.spyOn(page(harness).api, 'delete');
    select(harness, 'Select devices on this page');
    await harness.fixture.whenStable();
    click(harness, 'Delete selected devices');
    await decide(true);
    const write = await nextRequest('AdminDeleteDevice');
    const completion: unknown = submitted.mock.results[0]?.value;
    if (!(completion instanceof Promise)) throw new Error('Missing submitted deletion.');
    const rejection = expect(completion).rejects.toThrow('Device not found');
    await router.navigateByUrl(path.replace(branchA, branchB));
    await harness.fixture.whenStable();
    http
      .expectOne((request) => operation(request, 'AdminDevices'))
      .flush(list([{ ...beta, branchId: branchB }]));
    await harness.fixture.whenStable();
    write.flush({
      errors: [
        {
          message: 'Device not found',
          extensions: { code: 'NOT_FOUND', requestId: 'retired-delete' },
        },
      ],
    });
    await rejection;
    await harness.fixture.whenStable();
    expect(page(harness).deletionResult()).toBeNull();
    expect(page(harness).deleting()).toBe(false);
    expect(harness.routeNativeElement?.textContent).not.toContain('retired-delete');
    http.expectNone('/graphql');
  });
});
