import { TestBed } from '@angular/core/testing';
import { ADMIN_RUNTIME_CONFIG } from '../../../../core/config/admin-config';
import { expectCatalogParity } from '../../../../i18n/catalog-parity';
import { googleMapDirections, googleMapEmbed, locationMap, mapCoordinates } from '../location-map';
import { MapPreview } from './map-preview';
import bg from './bg.json';
import en from './en.json';

describe('Karma Google Maps', () => {
  it('keeps Bulgarian and English labels in parity', () => {
    expectCatalogParity(bg, en);
  });

  it('uses validated zero/boundary coordinates and fixed Google hosts', () => {
    expect(mapCoordinates(0, 0)).toEqual({ latitude: 0, longitude: 0 });
    expect(mapCoordinates(90, -180)).toEqual({ latitude: 90, longitude: -180 });
    for (const [latitude, longitude] of [
      [null, 0],
      [0, undefined],
      [91, 0],
      [0, -181],
      [NaN, 0],
      [0, Infinity],
    ]) {
      expect(mapCoordinates(latitude, longitude)).toBeNull();
      expect(locationMap(latitude, longitude)).toBeNull();
    }
    const location = new URL(locationMap(0, 0) ?? '');
    expect(location.origin).toBe('https://www.google.com');
    expect(location.searchParams.get('query')).toBe('0,0');
    const origin = { latitude: 0, longitude: 0 };
    const destination = { latitude: 42.7, longitude: 23.3 };
    const route = new URL(googleMapDirections(origin, destination));
    expect(route.searchParams.get('origin')).toBe('0,0');
    expect(route.searchParams.get('destination')).toBe('42.7,23.3');
    expect(route.searchParams.get('travelmode')).toBe('driving');
    const embedded = new URL(googleMapEmbed('key&origin=other', 'bg', origin, destination));
    expect(embedded.origin).toBe('https://www.google.com');
    expect(embedded.pathname).toBe('/maps/embed/v1/directions');
    expect(embedded.searchParams.get('key')).toBe('key&origin=other');
    expect(embedded.searchParams.get('origin')).toBe('0,0');
    expect(embedded.searchParams.get('language')).toBe('bg');
  });

  it('keeps an external Google Maps link available without a configured preview', () => {
    const fixture = TestBed.createComponent(MapPreview);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('origin', { latitude: 0, longitude: 0 });
    fixture.detectChanges();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('Missing map preview element');
    }
    const element = root;
    expect(element.querySelector('iframe')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('a')?.href).toBe(
      'https://www.google.com/maps/search/?api=1&query=0%2C0',
    );
    expect(element.textContent).toContain('Map preview is unavailable');
  });

  it('loads only after an explicit click and removes the iframe when coordinates change', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ADMIN_RUNTIME_CONFIG,
          useValue: { graphqlUrl: '/graphql', googleMapsEmbedApiKey: 'map-test-key' },
        },
      ],
    });
    const fixture = TestBed.createComponent(MapPreview);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('origin', { latitude: 0, longitude: 0 });
    fixture.detectChanges();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('Missing map preview element');
    }
    const element = root;
    expect(element.querySelector('iframe')).toBeNull();
    element.querySelector('button')?.click();
    fixture.detectChanges();
    const frame = element.querySelector('iframe');
    expect(frame?.getAttribute('src')).toContain('/maps/embed/v1/place?');
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(frame?.title).toBe('Last reported location');
    fixture.componentRef.setInput('origin', { latitude: 42.7, longitude: 23.3 });
    fixture.detectChanges();
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('shows only a valid available endpoint and never creates directions from invalid coordinates', () => {
    const fixture = TestBed.createComponent(MapPreview);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('route', true);
    fixture.componentRef.setInput('origin', { latitude: 91, longitude: 0 });
    fixture.componentRef.setInput('destination', { latitude: 0, longitude: 0 });
    fixture.detectChanges();
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error('Missing map preview element');
    }
    const element = root;
    expect(element.querySelector('a')?.href).toContain('/maps/search/');
    expect(element.textContent).toContain('Only one recorded endpoint');
    expect(element.textContent).toContain('does not supply the driven GPS track');
    fixture.componentRef.setInput('destination', null);
    fixture.detectChanges();
    expect(element.querySelector('a')).toBeNull();
    expect(element.querySelector('iframe')).toBeNull();
    expect(element.textContent).toContain('No valid coordinates');
  });
});
