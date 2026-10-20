import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { defaultFleetDisplay, FLEET_DISPLAY } from '../../../ui/format/fleet-format';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { DevicesView } from './devices-view';

describe('DevicesView thresholds', () => {
  it('updates the offline caption with the current Branch preferences in both languages', async () => {
    const preferences = signal(defaultFleetDisplay);
    const language = signal<'en' | 'bg'>('en');
    TestBed.configureTestingModule({
      providers: [
        { provide: FLEET_DISPLAY, useValue: preferences },
        { provide: UI_LANGUAGE, useValue: language },
      ],
    });
    const fixture = TestBed.createComponent(DevicesView);
    fixture.componentRef.setInput('branchName', 'Test Fleet');
    fixture.componentRef.setInput('dataAsOf', '2026-10-18T07:00:00.000Z');
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('total', 0);
    fixture.componentRef.setInput('view', { kind: 'empty' });
    fixture.componentRef.setInput('state', {
      search: '',
      conditions: [],
      sort: null,
      page: 1,
      pageSize: 25,
    });
    fixture.componentRef.setInput('kpis', { online: 0, offline: 0, stock: 0, outdated: null });
    await fixture.whenStable();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing Devices view.');
    }
    expect(element.textContent).toContain('no connection for 48 h');
    preferences.set({ ...defaultFleetDisplay, notReportingHours: 24 });
    await fixture.whenStable();
    expect(element.textContent).toContain('no connection for 24 h');
    expect(element.textContent).not.toContain('no connection for 48 h');
    language.set('bg');
    await fixture.whenStable();
    expect(element.textContent).toContain('без връзка от 24 ч.');
    fixture.destroy();
  });
});
