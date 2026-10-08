import { type HttpClient, HttpHeaders, HttpRequest, HttpEventType } from '@angular/common/http';
import { firstValueFrom, filter, fromEvent, takeUntil, tap, timeout } from 'rxjs';
import type { AdminUploadIntentMutation } from '../../../../generated/graphql/operations';

export async function directUpload(
  http: HttpClient,
  target: AdminUploadIntentMutation['createReferenceUploadIntent'],
  file: File,
  signal: AbortSignal,
  progress: (percent: number) => void,
): Promise<void> {
  signal.throwIfAborted();
  const headers = target.headers.reduce(
    (result, header) => result.set(header.name, header.value),
    new HttpHeaders(),
  );
  const request = new HttpRequest(target.method, target.uploadUrl, file, {
    headers,
    reportProgress: true,
    responseType: 'text',
  });
  await firstValueFrom(
    http.request(request).pipe(
      tap((event) => {
        if (event.type === HttpEventType.UploadProgress && event.total && !signal.aborted)
          progress(Math.round((event.loaded / event.total) * 100));
      }),
      filter((event) => event.type === HttpEventType.Response),
      takeUntil(fromEvent(signal, 'abort')),
      timeout(120_000),
    ),
  );
  signal.throwIfAborted();
}
