import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApolloClient } from '@apollo/client/core';
import { VehiclesPage } from './vehicles-page';
import type { AdminVehicleFragment } from '../../../../generated/graphql/operations';

const storeA = '10000000-0000-4000-8000-000000000001';
const storeB = '10000000-0000-4000-8000-000000000002';
const vehicleA: AdminVehicleFragment = {
  id: '20000000-0000-4000-8000-000000000001',
  storeId: storeA,
  licensePlate: 'Sofia notebook',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const vehicleB: AdminVehicleFragment = {
  id: '20000000-0000-4000-8000-000000000002',
  storeId: storeB,
  licensePlate: 'Plovdiv notebook',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function operation(request: HttpRequest<unknown>, name: string, storeId: string): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-store-id') === storeId &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}

function vehiclePage(vehicle: AdminVehicleFragment) {
  return {
    data: {
      referenceVehicles: {
        __typename: 'ReferenceVehiclePage',
        items: [{ ...vehicle, __typename: 'ReferenceVehicle' }],
        total: 1,
        offset: 0,
        limit: 20,
      },
    },
  };
}

function pageElement(fixture: ComponentFixture<VehiclesPage>): HTMLElement {
  const element: unknown = fixture.nativeElement;
  if (!(element instanceof HTMLElement)) throw new Error('Missing Vehicles page element.');
  return element;
}

describe('Vehicles Apollo scope', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });

  async function mount(storeId: string) {
    const fixture = TestBed.createComponent(VehiclesPage);
    fixture.componentRef.setInput('store', {
      id: storeId,
      name: storeId === storeA ? 'Sofia' : 'Plovdiv',
    });
    fixture.componentRef.setInput('language', 'en');
    await fixture.whenStable();
    return fixture;
  }

  it('separates concurrent identical list queries, entity caches and request headers', async () => {
    const a = await mount(storeA);
    const b = await mount(storeB);
    const readA = http.expectOne((request) => operation(request, 'AdminVehicles', storeA));
    const readB = http.expectOne((request) => operation(request, 'AdminVehicles', storeB));
    expect(readA.request.headers.get('x-request-id')).not.toBe(
      readB.request.headers.get('x-request-id'),
    );
    expect(readB.request.headers.get('Accept-Language')).toBe('en');
    readB.flush(vehiclePage(vehicleB));
    readA.flush(vehiclePage(vehicleA));
    await a.whenStable();
    await b.whenStable();
    expect(a.componentInstance.page()?.items[0]?.storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.storeId).toBe(storeB);
    a.destroy();
    b.destroy();
  });

  it('keeps a submitted mutation alive after A is destroyed and never invalidates B or a new A', async () => {
    const a = await mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminVehicles', storeA))
      .flush(vehiclePage(vehicleA));
    await a.whenStable();
    const oldApi = a.componentInstance.api;
    const mutation = oldApi.update({ id: vehicleA.id, input: { licensePlate: 'Saved in old A' } });
    const write = http.expectOne((request) => operation(request, 'AdminUpdateVehicle', storeA));
    a.destroy();
    const b = await mount(storeB);
    http
      .expectOne((request) => operation(request, 'AdminVehicles', storeB))
      .flush(vehiclePage(vehicleB));
    await b.whenStable();
    const newA = await mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminVehicles', storeA))
      .flush(vehiclePage(vehicleA));
    await newA.whenStable();
    expect(write.cancelled).toBe(false);
    write.flush({
      data: {
        updateReferenceVehicle: {
          ...vehicleA,
          __typename: 'ReferenceVehicle',
          licensePlate: 'Saved in old A',
        },
      },
    });
    expect((await mutation).storeId).toBe(storeA);
    expect(b.componentInstance.page()?.items[0]?.licensePlate).toBe(vehicleB.licensePlate);
    expect(newA.componentInstance.page()?.items[0]?.licensePlate).toBe(vehicleA.licensePlate);
    http.expectNone('/graphql');
    await expect(
      oldApi.update({ id: vehicleA.id, input: { licensePlate: 'Obsolete write' } }),
    ).rejects.toThrow('active Vehicles workspace');
    b.destroy();
    newA.destroy();
  });

  it('releases a retired client after a failed mutation without changing the new store', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = await mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminVehicles', storeA))
      .flush(vehiclePage(vehicleA));
    await a.whenStable();
    const mutation = a.componentInstance.api.update({
      id: vehicleA.id,
      input: { licensePlate: '' },
    });
    const rejection = expect(mutation).rejects.toThrow('Invalid license plate');
    const write = http.expectOne((request) => operation(request, 'AdminUpdateVehicle', storeA));
    a.destroy();
    expect(stop).not.toHaveBeenCalled();
    const b = await mount(storeB);
    http
      .expectOne((request) => operation(request, 'AdminVehicles', storeB))
      .flush(vehiclePage(vehicleB));
    await b.whenStable();
    write.flush({
      errors: [
        {
          message: 'Invalid license plate',
          extensions: { code: 'CONFLICT', requestId: 'failed-write' },
        },
      ],
    });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(b.componentInstance.error()).toBeNull();
    expect(b.componentInstance.page()?.items[0]?.storeId).toBe(storeB);
    http.expectNone('/graphql');
    b.destroy();
  });

  it('retains loaded rows on a GraphQL refresh error and recovers with a new request ID', async () => {
    const a = await mount(storeA);
    http
      .expectOne((request) => operation(request, 'AdminVehicles', storeA))
      .flush(vehiclePage(vehicleA));
    await a.whenStable();
    a.componentInstance.refresh();
    const failed = http.expectOne('/graphql');
    failed.flush({
      errors: [
        {
          message: 'Vehicles unavailable',
          extensions: { code: 'SERVICE_UNAVAILABLE', requestId: 'refresh-id' },
        },
      ],
    });
    await a.whenStable();
    expect(a.componentInstance.page()?.items[0]?.licensePlate).toBe(vehicleA.licensePlate);
    expect(a.componentInstance.failure()).toContain('Vehicles unavailable (refresh-id)');
    expect(pageElement(a).querySelector('[role="alert"]')?.textContent).toContain('refresh-id');
    expect(pageElement(a).querySelector('tbody')?.textContent).toContain(vehicleA.licensePlate);
    a.componentInstance.refresh();
    const retry = http.expectOne('/graphql');
    expect(retry.request.headers.get('x-request-id')).not.toBe(
      failed.request.headers.get('x-request-id'),
    );
    retry.flush(vehiclePage(vehicleA));
    await a.whenStable();
    expect(a.componentInstance.error()).toBeNull();
    a.destroy();
  });

  it('stops a retired client only after both submitted writes settle', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop');
    const a = await mount(storeA);
    http.expectOne('/graphql').flush(vehiclePage(vehicleA));
    await a.whenStable();
    const api = a.componentInstance.api;
    const first = api.update({ id: vehicleA.id, input: { licensePlate: 'First write' } });
    const firstWrite = http.expectOne('/graphql');
    const second = api.update({ id: vehicleA.id, input: { licensePlate: 'Second write' } });
    const rejection = expect(second).rejects.toThrow('Second failed');
    const secondWrite = http.expectOne('/graphql');
    a.destroy();
    expect(stop).not.toHaveBeenCalled();
    expect(firstWrite.cancelled).toBe(false);
    expect(secondWrite.cancelled).toBe(false);
    firstWrite.flush({
      data: { updateReferenceVehicle: { ...vehicleA, __typename: 'ReferenceVehicle' } },
    });
    await first;
    expect(stop).not.toHaveBeenCalled();
    secondWrite.flush({ errors: [{ message: 'Second failed' }] });
    await rejection;
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('renders an initial error and retry followed by the empty Table state', async () => {
    const a = await mount(storeA);
    const element = pageElement(a);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading vehicles');
    const read = http.expectOne('/graphql');
    const requestId = read.request.headers.get('x-request-id');
    read.error(new ProgressEvent('error'));
    await a.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(requestId);
    expect(element.querySelector('tbody')?.textContent).not.toContain('No vehicles yet.');
    const retry = element.querySelector<HTMLButtonElement>('button');
    expect(retry?.textContent).toContain('Retry');
    retry?.click();
    const next = http.expectOne('/graphql');
    expect(next.request.headers.get('x-request-id')).not.toBe(requestId);
    next.flush({
      data: {
        referenceVehicles: {
          __typename: 'ReferenceVehiclePage',
          items: [],
          total: 0,
          offset: 0,
          limit: 20,
        },
      },
    });
    await a.whenStable();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('tbody')?.textContent).toContain('No vehicles yet.');
    expect(element.querySelector('th[psortablecolumn="licensePlate"]')?.textContent.trim()).toBe(
      'License Plate',
    );
    a.destroy();
  });
});
