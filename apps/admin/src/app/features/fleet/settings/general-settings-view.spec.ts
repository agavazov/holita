import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { GeneralSettingsView, type GeneralSettings } from './general-settings-view';

const settings: GeneralSettings = {
  name: 'Sofia Fleet',
  timeZone: 'Europe/Sofia',
  distanceUnit: 'km',
  volumeUnit: 'l',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
  criticalAlerts: false,
  dailySummary: false,
  documentReminders: false,
};

describe('GeneralSettingsView load and field feedback', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UI_LANGUAGE, useValue: signal('en') }],
    });
  });

  it('keeps the form hidden while loading or failed and exposes a real retry action', async () => {
    const fixture = TestBed.createComponent(GeneralSettingsView);
    fixture.componentRef.setInput('branchName', 'Sofia Fleet');
    fixture.componentRef.setInput('state', 'loading');
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    await fixture.whenStable();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('Missing General settings view.');
    }
    expect(root.querySelector('form')?.parentElement?.hidden).toBe(true);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Loading settings');
    fixture.componentRef.setInput('state', 'error');
    fixture.componentRef.setInput('loadError', 'Read failed.');
    await fixture.whenStable();
    expect(root.querySelector('form')?.parentElement?.hidden).toBe(true);
    expect(root.textContent).toContain('Read failed.');
    const action = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent.trim() === 'Try again',
    );
    if (!action) {
      throw new Error('Missing Retry action.');
    }
    action.click();
    expect(retry).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('settings', settings);
    fixture.componentRef.setInput('state', 'ready');
    await fixture.whenStable();
    expect(root.querySelector('form')?.parentElement?.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>('#settings-name')?.value).toBe('Sofia Fleet');
  });

  it('focuses a synchronous mapped Select rejection without requiring a rendered busy frame', async () => {
    const fixture = TestBed.createComponent(GeneralSettingsView);
    fixture.componentRef.setInput('branchName', 'Sofia Fleet');
    fixture.componentRef.setInput('settings', settings);
    await fixture.whenStable();
    fixture.componentRef.setInput('saving', true);
    fixture.componentRef.setInput('fieldErrors', { timeZone: 'Choose a supported time zone.' });
    fixture.componentRef.setInput('saving', false);
    await fixture.whenStable();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('Missing General settings view.');
    }
    const control = root.querySelector('#settings-timeZone');
    expect(control?.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#settings-timeZone-error')?.textContent).toContain(
      'Choose a supported time zone.',
    );
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(control);
    });
  });
});
