import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { expectCatalogParity } from '../../../i18n/catalog-parity';
import { KarmaCarHeader } from './karma-car-header';
import bg from './bg.json';
import en from './en.json';

@Component({
  imports: [KarmaCarHeader],
  template:
    '<holita-karma-car-header language="en" carId="41" carNumber="TEST 41" title="Location" />',
})
class HeaderHost {}

describe('Karma truck header and navigation', () => {
  it('keeps Bulgarian and English catalogs in parity', () => {
    expectCatalogParity(bg, en);
  });

  it('renders six real links and marks only the exact current section active with filtered URLs', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'en/karma-client/cars/41/location', component: HeaderHost },
          { path: 'en/karma-client/cars/41/trips', component: HeaderHost },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(
      '/en/karma-client/cars/41/location?listQ=TEST&listSize=25&listFirst=50&listProject=12&from=2026-01-01T00:00:00&cursor=old',
    );
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement;
    if (!element) {
      throw new Error('Missing header host');
    }
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toBe('Location');
    expect(element.textContent).toContain('TEST 41 · Karma ID 41');
    const links = [...element.querySelectorAll('nav a')];
    expect(links).toHaveLength(6);
    const current = element.querySelector('nav a[aria-current="page"]');
    expect(current?.textContent.trim()).toBe('Location');
    expect(element.querySelectorAll('nav a[aria-current="page"]')).toHaveLength(1);
    for (const link of links) {
      const url = new URL(link.getAttribute('href') ?? '', window.location.origin);
      expect(url.searchParams.get('listQ')).toBe('TEST');
      expect(url.searchParams.get('listFirst')).toBe('50');
      expect(url.searchParams.has('from')).toBe(false);
      expect(url.searchParams.has('cursor')).toBe(false);
    }
    const back = element.querySelector('a.page-header__back');
    expect(back?.getAttribute('href')).toBe(
      '/en/karma-client/cars?q=TEST&size=25&first=50&project=12',
    );
    await harness.navigateByUrl('/en/karma-client/cars/41/trips?from=2026-01-01T00:00:00');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement).not.toBe(element);
    expect(element.isConnected).toBe(false);
    expect(
      harness.routeNativeElement.querySelector('nav a[aria-current="page"]')?.textContent.trim(),
    ).toBe('Trips');
  });

  it('exposes refresh as an event and honors loading, invalid filters and invalid IDs', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(KarmaCarHeader);
    fixture.componentRef.setInput('language', 'bg');
    fixture.componentRef.setInput('carId', '41');
    fixture.componentRef.setInput('title', 'Местоположение');
    const events: number[] = [];
    fixture.componentInstance.refreshRequest.subscribe(() => events.push(1));
    fixture.detectChanges();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('Missing header element');
    }
    expect(root.querySelector('button')?.textContent.trim()).toBe('Обнови');
    root.querySelector('button')?.click();
    expect(events).toHaveLength(1);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(root.querySelector('button')?.disabled).toBe(true);
    fixture.componentRef.setInput('busy', false);
    fixture.componentRef.setInput('error', true);
    fixture.componentRef.setInput('refreshDisabled', true);
    fixture.detectChanges();
    expect(root.querySelector('button')?.textContent.trim()).toBe('Опитай отново');
    expect(root.querySelector('button')?.disabled).toBe(true);
    fixture.componentRef.setInput('canNavigate', false);
    fixture.detectChanges();
    expect(root.querySelector('nav')).toBeNull();
    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('.page-header__back')).not.toBeNull();
  });
});
