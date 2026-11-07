import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class AdminErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    // FetchBackend teardown can surface a native request cancellation globally.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    super.handleError(error);
  }
}
