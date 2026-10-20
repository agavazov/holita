import { provideHttpClient, type HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { AdminFleetSettingsFragment } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { FleetPreferences } from './fleet-preferences';
import { GeneralSettingsApi } from './general-settings-api';

const branchA = '10000000-0000-4000-8000-000000000001';
const branchB = '10000000-0000-4000-8000-000000000002';
const defaults: AdminFleetSettingsFragment & { readonly __typename: 'FleetSettings' } = {
  __typename: 'FleetSettings',
  timeZone: 'Europe/Sofia',
  distanceUnit: 'KM',
  volumeUnit: 'LITRE',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
};

@Component({
  providers: [GeneralSettingsApi, FleetPreferences],
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PreferencesHost {
  readonly preferences = inject(FleetPreferences);
}

function operation(request: HttpRequest<unknown>, branchId = branchA): boolean {
  const body: unknown = request.body;
  return (
    request.url === '/graphql' &&
    request.headers.get('x-branch-id') === branchId &&
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === 'AdminFleetPreferences'
  );
}

describe('FleetPreferences mounted scope', () => {
  let http: HttpTestingController;
  const fixtures: ComponentFixture<PreferencesHost>[] = [];
  function mount(branchId = branchA, language: 'bg' | 'en' = 'en') {
    const fixture = TestBed.createComponent(PreferencesHost);
    fixtures.push(fixture);
    fixture.componentInstance.preferences.initialize(branchId, language);
    return fixture;
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).start({
      token: 'preferences-token',
      tenant: { id: '01000000-0000-4000-8000-000000000001', name: 'Tenant A' },
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    fixtures.splice(0).forEach((fixture) => {
      fixture.destroy();
    });
    http.verify({ ignoreCancelled: true });
  });

  it('has no settings before a real response and retries a failed initial read in its captured scope', async () => {
    const fixture = mount();
    const preferences = fixture.componentInstance.preferences;
    expect(preferences.settings()).toBeNull();
    expect(preferences.loading()).toBe(true);
    const initial = http.expectOne((request) => operation(request));
    expect(initial.request.headers.get('Accept-Language')).toBe('en');
    initial.flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(preferences.settings()).toBeNull();
    expect(preferences.loading()).toBe(false);
    expect(preferences.error()).not.toBeNull();
    preferences.retry();
    expect(preferences.loading()).toBe(true);
    expect(preferences.error()).toBeNull();
    const retry = http.expectOne((request) => operation(request));
    expect(retry.request.headers.get('authorization')).toBe('Bearer preferences-token');
    expect(retry.request.headers.get('x-request-id')).not.toBe(
      initial.request.headers.get('x-request-id'),
    );
    retry.flush({ data: { fleetSettings: defaults } });
    await fixture.whenStable();
    expect(preferences.settings()).toEqual(defaults);
    expect(preferences.loading()).toBe(false);
    expect(preferences.error()).toBeNull();
    preferences.initialize(branchA, 'en');
    http.expectNone('/graphql');
  });

  it('applies the actual saved settings while a new Branch starts unloaded and receives its own defaults', async () => {
    const a = mount();
    http.expectOne((request) => operation(request)).flush({ data: { fleetSettings: defaults } });
    await a.whenStable();
    const saved: AdminFleetSettingsFragment = {
      ...defaults,
      timeZone: 'Europe/Athens',
      distanceUnit: 'MI',
      volumeUnit: 'US_GALLON',
      lowFuelPct: 20,
    };
    a.componentInstance.preferences.apply(saved);
    expect(a.componentInstance.preferences.settings()).toEqual(saved);
    expect(() => {
      a.componentInstance.preferences.initialize(branchB, 'en');
    }).toThrow('one Branch and language');
    a.destroy();
    const b = mount(branchB, 'bg');
    expect(b.componentInstance.preferences.settings()).toBeNull();
    const read = http.expectOne((request) => operation(request, branchB));
    expect(read.request.headers.get('Accept-Language')).toBe('bg');
    read.flush({ data: { fleetSettings: defaults } });
    await b.whenStable();
    expect(b.componentInstance.preferences.settings()).toEqual(defaults);
  });

  it('cancels an obsolete pending read and never carries its state into a fresh mount', async () => {
    const a = mount();
    const retired = http.expectOne((request) => operation(request));
    a.destroy();
    expect(retired.cancelled).toBe(true);
    const fresh = mount();
    expect(fresh.componentInstance.preferences.settings()).toBeNull();
    const read = http.expectOne((request) => operation(request));
    expect(read.request.headers.get('x-request-id')).not.toBe(
      retired.request.headers.get('x-request-id'),
    );
    read.flush({ data: { fleetSettings: defaults } });
    await fresh.whenStable();
    expect(fresh.componentInstance.preferences.settings()).toEqual(defaults);
    expect(fresh.componentInstance.preferences.error()).toBeNull();
  });
});
