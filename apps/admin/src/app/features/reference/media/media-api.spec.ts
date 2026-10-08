import {
  HttpBackend,
  HttpEventType,
  HttpXhrBackend,
  provideHttpClient,
  type HttpRequest,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApolloClient } from '@apollo/client/core';
import { EventGallery } from './event-gallery/event-gallery';
import { MediaApi } from './media-api';
import {
  eventA,
  imageRecord,
  mediaResponse,
  storeA,
  storeB,
  uploadTarget,
} from './media-fixtures.spec-helper';
function operation(request: HttpRequest<unknown>, name: string): boolean {
  const body: unknown = request.body;
  return (
    typeof body === 'object' &&
    body !== null &&
    'operationName' in body &&
    body.operationName === name
  );
}
describe('Gallery captured client, drafts and direct upload lifecycle', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HttpXhrBackend, useExisting: HttpBackend },
      ],
    });
    TestBed.overrideComponent(EventGallery, { add: { providers: [MediaApi] } });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    vi.restoreAllMocks();
  });
  async function mount(store = storeA, event = eventA) {
    const fixture = TestBed.createComponent(EventGallery);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('editable', true);
    fixture.debugElement.injector.get(MediaApi).initialize(store, 'en', event);
    await fixture.whenStable();
    return fixture;
  }
  it('retires reads and isolates identical media entities through A → B → A', async () => {
    const a = await mount(),
      old = http.expectOne('/graphql');
    a.destroy();
    expect(old.cancelled).toBe(true);
    const b = await mount(storeB);
    const read = http.expectOne('/graphql');
    expect(read.request.headers.get('x-store-id')).toBe(storeB);
    read.flush(mediaResponse([imageRecord('B.png')]));
    await b.whenStable();
    const next = await mount();
    http.expectOne('/graphql').flush(mediaResponse());
    await next.whenStable();
    expect(next.componentInstance.saved()[0]?.originalName).toBe('first.png');
    expect(b.componentInstance.saved()[0]?.originalName).toBe('B.png');
    b.destroy();
    next.destroy();
  });
  it('retains complete-set conflicts and reloads changed membership before cancelling a draft', async () => {
    const a = await mount(),
      second = imageRecord('second.png', '80000000-0000-4000-8000-000000000002');
    http.expectOne('/graphql').flush(mediaResponse([imageRecord(), second]));
    await a.whenStable();
    a.componentInstance.moveBy(second.id, -1);
    const saving = a.componentInstance.saveOrder();
    await a.componentInstance.saveOrder();
    const write = http.expectOne((request) => operation(request, 'AdminReorderMedia'));
    expect(write.request.body).toMatchObject({
      variables: { eventId: eventA, ids: [second.id, imageRecord().id] },
    });
    write.flush({ errors: [{ message: 'The gallery changed.' }] });
    await saving;
    expect(a.componentInstance.dirty()).toBe(true);
    const cancel = a.componentInstance.cancelOrder();
    http.expectOne((request) => operation(request, 'AdminMedia')).flush(mediaResponse([second]));
    await cancel;
    expect(a.componentInstance.dirty()).toBe(false);
    expect(a.componentInstance.rows()).toHaveLength(1);
    a.destroy();
  });
  it('preserves GraphQL read diagnostics separately from direct binary failures', async () => {
    const a = await mount();
    const read = http.expectOne('/graphql');
    const requestId = read.request.headers.get('x-request-id');
    if (!requestId) throw new Error('Missing request diagnostics header.');
    read.flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    await a.whenStable();
    expect(a.componentInstance.failure()).toBe(
      `The image operation failed. Try again. (${requestId})`,
    );
    a.destroy();
  });
  it('sends only capability headers and bytes, reports progress, and cancels before finalization', async () => {
    const a = await mount();
    http.expectOne('/graphql').flush(mediaResponse([]));
    await a.whenStable();
    const saving = a.componentInstance.upload(
      new File(['png'], 'image.png', { type: 'image/png' }),
    );
    http
      .expectOne((request) => operation(request, 'AdminUploadIntent'))
      .flush({ data: { createReferenceUploadIntent: uploadTarget } });
    const transfer = await vi.waitFor(() => http.expectOne(uploadTarget.uploadUrl));
    expect(transfer.request.method).toBe('PUT');
    expect(transfer.request.headers.keys()).toEqual(['authorization']);
    expect(transfer.request.body).toBeInstanceOf(File);
    transfer.event({ type: HttpEventType.UploadProgress, loaded: 2, total: 3 });
    expect(a.componentInstance.uploading()?.percent).toBe(67);
    a.componentInstance.cancelUpload();
    await saving;
    expect(transfer.cancelled).toBe(true);
    http.expectNone((request) => operation(request, 'AdminFinalizeUpload'));
    a.destroy();
  });
  it('cancels an intent on navigation without sending bytes after its late response', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop'),
      a = await mount();
    http.expectOne('/graphql').flush(mediaResponse([]));
    await a.whenStable();
    const saving = a.componentInstance.upload(
      new File(['png'], 'image.png', { type: 'image/png' }),
    );
    const intent = http.expectOne('/graphql');
    a.destroy();
    expect(intent.cancelled).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    intent.flush({ data: { createReferenceUploadIntent: uploadTarget } });
    await saving;
    http.expectNone(uploadTarget.uploadUrl);
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it('lets submitted finalization settle against A, with no notification or state change in B', async () => {
    const stop = vi.spyOn(ApolloClient.prototype, 'stop'),
      a = await mount();
    http.expectOne('/graphql').flush(mediaResponse([]));
    await a.whenStable();
    const saving = a.componentInstance.upload(
      new File(['png'], 'image.png', { type: 'image/png' }),
    );
    http.expectOne('/graphql').flush({ data: { createReferenceUploadIntent: uploadTarget } });
    const transfer = await vi.waitFor(() => http.expectOne(uploadTarget.uploadUrl));
    transfer.flush('');
    const finalize = await vi.waitFor(() =>
      http.expectOne((request) => operation(request, 'AdminFinalizeUpload')),
    );
    expect(finalize.request.headers.get('x-store-id')).toBe(storeA);
    a.destroy();
    expect(finalize.cancelled).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    const b = await mount(storeB);
    http.expectOne('/graphql').flush(mediaResponse([]));
    await b.whenStable();
    finalize.flush({ data: { finalizeReferenceUpload: imageRecord() } });
    await saving;
    expect(b.componentInstance.rows()).toEqual([]);
    expect(b.componentInstance.notice()).toBe('');
    expect(stop).toHaveBeenCalledTimes(1);
    b.destroy();
  });
  it('validates file and alt text limits, clears alt text to null and preserves failed input', async () => {
    const a = await mount();
    http.expectOne('/graphql').flush(mediaResponse());
    await a.whenStable();
    await a.componentInstance.upload(new File(['gif'], 'image.gif', { type: 'image/gif' }));
    expect(a.componentInstance.failure()).toContain('at most 5 MiB');
    http.expectNone('/graphql');
    a.componentInstance.editAlt(imageRecord());
    a.componentInstance.altText.setValue('x'.repeat(301));
    await a.componentInstance.saveAlt();
    http.expectNone('/graphql');
    a.componentInstance.altText.setValue(' ');
    const saving = a.componentInstance.saveAlt();
    const write = http.expectOne((request) => operation(request, 'AdminUpdateMedia'));
    expect(write.request.body).toMatchObject({ variables: { input: { altText: null } } });
    write.flush({ errors: [{ message: 'Try again.' }] });
    await saving;
    expect(a.componentInstance.editing()).not.toBeNull();
    expect(a.componentInstance.altText.value).toBe(' ');
    a.destroy();
  });
});
