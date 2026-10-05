import type { TFunction } from 'i18next';
import type { CreateReferenceUploadIntentMutation } from '../generated/graphql/operations.js';

type Target = CreateReferenceUploadIntentMutation['createReferenceUploadIntent'];
export function directUpload(
  target: Target,
  file: File,
  signal: AbortSignal,
  progress: (percent: number) => void,
  t: TFunction<'reference'>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Upload cancelled.', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    const abort = () => {
      xhr.abort();
    };
    xhr.open(target.method, target.uploadUrl);
    xhr.timeout = 120_000;
    for (const header of target.headers) xhr.setRequestHeader(header.name, header.value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(t('media.upload.rejected')));
    };
    xhr.onerror = () => {
      reject(new Error(t('media.upload.connectionLost')));
    };
    xhr.ontimeout = () => {
      reject(new Error(t('media.upload.timeout')));
    };
    xhr.onabort = () => {
      reject(new DOMException('Upload cancelled.', 'AbortError'));
    };
    xhr.onloadend = () => {
      signal.removeEventListener('abort', abort);
    };
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(file);
  });
}
