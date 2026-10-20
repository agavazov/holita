import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ROUTER_OUTLET_DATA } from '@angular/router';
import { injectDrawerHost, type DrawerHost } from './drawer-host';

describe('drawer host', () => {
  it('reports a saved record to the owning outlet', () => {
    const saved = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ROUTER_OUTLET_DATA, useValue: signal({ saved }) }],
    });
    TestBed.runInInjectionContext(injectDrawerHost).saved({
      recordId: 'vehicle',
      message: 'Saved',
    });
    expect(saved).toHaveBeenCalledWith({ recordId: 'vehicle', message: 'Saved' });
  });
  it('supports isolated drawers without an outlet', () => {
    expect(() => {
      TestBed.runInInjectionContext(injectDrawerHost).saved({ recordId: null, message: 'Saved' });
    }).not.toThrow();
  });
  it('ignores malformed outlet data', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ROUTER_OUTLET_DATA, useValue: signal({ saved: 'invalid' }) }],
    });
    expect(() => {
      TestBed.runInInjectionContext(injectDrawerHost).saved({ recordId: null, message: 'Saved' });
    }).not.toThrow();
  });
  it('keeps the owning vehicle and profile destination from valid outlet data', () => {
    const host: DrawerHost = {
      saved: vi.fn<DrawerHost['saved']>(),
      vehicleId: '20000000-0000-4000-8000-000000000001',
      closeLink: ['/', 'en', 'branch', 'fleet', 'vehicles', 'vehicle', 'trips'],
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ROUTER_OUTLET_DATA, useValue: signal(host) }],
    });
    expect(TestBed.runInInjectionContext(injectDrawerHost)).toBe(host);
  });
  it.each([{ vehicleId: 42 }, { vehicleId: null }, { vehicleId: {} }, { vehicleId: ['vehicle'] }])(
    'ignores an outlet with a non-string vehicleId: $vehicleId',
    ({ vehicleId }) => {
      const saved = vi.fn<DrawerHost['saved']>();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: ROUTER_OUTLET_DATA,
            useValue: signal({ saved, closeLink: ['/', 'en', 'branch'], vehicleId }),
          },
        ],
      });
      const host = TestBed.runInInjectionContext(injectDrawerHost);
      expect(host.vehicleId).toBeUndefined();
      expect(host.closeLink).toBeUndefined();
      host.saved({ recordId: 'vehicle', message: 'Saved' });
      expect(saved).not.toHaveBeenCalled();
    },
  );
});
