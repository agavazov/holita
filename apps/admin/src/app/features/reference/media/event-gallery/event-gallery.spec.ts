import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MediaApi } from '../media-api';
import { eventA, mediaResponse, storeA } from '../media-fixtures.spec-helper';
import { EventGallery } from './event-gallery';

describe('Gallery read recovery and action errors', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), MediaApi],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  async function mount() {
    const api = TestBed.inject(MediaApi);
    api.initialize(storeA, 'en', eventA);
    const watch = vi.spyOn(api, 'watchList');
    const fixture = TestBed.createComponent(EventGallery);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('editable', true);
    await fixture.whenStable();
    const result = watch.mock.results[0];
    if (result?.type !== 'return') throw new Error('Missing gallery query.');
    return { fixture, query: result.value };
  }

  it('clears a transient read failure after a successful background refresh', async () => {
    const { fixture, query } = await mount();
    http.expectOne('/graphql').flush({ errors: [{ message: 'Temporary media outage' }] });
    await fixture.whenStable();
    expect(fixture.componentInstance.failure()).toContain('Temporary media outage');
    const polling = query.refetch();
    http.expectOne('/graphql').flush(mediaResponse());
    await polling;
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBeNull();
    expect(fixture.componentInstance.rows()).toHaveLength(1);
    const root: unknown = fixture.nativeElement;
    if (!(root instanceof HTMLElement)) throw new Error('Missing gallery element.');
    expect(root.textContent).not.toContain('Temporary media outage');
    fixture.destroy();
  });

  it('preserves a rejected action while a background read succeeds', async () => {
    const { fixture, query } = await mount();
    http.expectOne('/graphql').flush(mediaResponse());
    await fixture.whenStable();
    await fixture.componentInstance.upload(new File([], 'empty.png', { type: 'image/png' }));
    expect(fixture.componentInstance.error()).toBe('invalid-file');
    const polling = query.refetch();
    http.expectOne('/graphql').flush(mediaResponse());
    await polling;
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBe('invalid-file');
    expect(fixture.componentInstance.rows()).toHaveLength(1);
    fixture.destroy();
  });
  it('clears an action error when explicitly refreshing the gallery', async () => {
    const { fixture } = await mount();
    http.expectOne('/graphql').flush(mediaResponse());
    await fixture.whenStable();
    await fixture.componentInstance.upload(new File([], 'empty.png', { type: 'image/png' }));
    const refreshing = fixture.componentInstance.refresh();
    http.expectOne('/graphql').flush(mediaResponse());
    await refreshing;
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBeNull();
    fixture.destroy();
  });
});
