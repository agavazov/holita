import { isSignal } from '@angular/core';
import { Check } from '@primeicons/angular/check';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { InfoCircle } from '@primeicons/angular/info-circle';
import { Times } from '@primeicons/angular/times';
import { TimesCircle } from '@primeicons/angular/times-circle';
import { Toast, type ToastPassThrough } from 'primeng/toast';
import { uiMessages } from '../app/ui/i18n/messages';

export const storyToastImports = [
  Toast,
  Check,
  ExclamationTriangle,
  InfoCircle,
  Times,
  TimesCircle,
];

/** Keep PrimeNG's toast lifecycle and styling, without its close button's native autofocus. */
export const storyToastTemplate = `
  <p-toast class="app-toast" position="top-right" mode="expanded" [life]="5000"
    [stackVisibleLimit]="3" [pt]="storyToastPt" [style]="storyToastStyle">
    <ng-template #headless let-message let-close="closeFn">
      @if (message) {
        <div class="p-toast-message-content">
          @switch (message.severity) {
            @case ('success') {
              <svg class="p-toast-message-icon" data-p-icon="check" aria-hidden="true"></svg>
            }
            @case ('warn') {
              <svg class="p-toast-message-icon" data-p-icon="exclamation-triangle" aria-hidden="true"></svg>
            }
            @case ('error') {
              <svg class="p-toast-message-icon" data-p-icon="times-circle" aria-hidden="true"></svg>
            }
            @default {
              <svg class="p-toast-message-icon" data-p-icon="info-circle" aria-hidden="true"></svg>
            }
          }
          <div class="p-toast-message-text">
            @if (message.summary) {
              <div class="p-toast-summary">{{ message.summary }}</div>
            }
            @if (message.detail) {
              <div class="p-toast-detail">{{ message.detail }}</div>
            }
          </div>
          @if (message.closable !== false) {
            <button type="button" class="p-toast-close-button" data-pc-section="closebutton"
              aria-label="${uiMessages.en.close}" (click)="close($event)">
              <svg class="p-toast-close-icon" data-p-icon="times" aria-hidden="true"></svg>
            </button>
          }
        </div>
      }
    </ng-template>
  </p-toast>
`;

/** Toast forwards these options to each message; its instance is intentionally typed unknown. */
export const storyToastPt: ToastPassThrough = {
  message: ({ instance }) => {
    const message: unknown =
      typeof instance === 'object' &&
      instance !== null &&
      'message' in instance &&
      isSignal(instance.message)
        ? instance.message()
        : null;
    const success =
      typeof message === 'object' &&
      message !== null &&
      'severity' in message &&
      message.severity === 'success';
    return { role: success ? 'status' : 'alert', 'aria-live': success ? 'polite' : 'assertive' };
  },
};

/** Override PrimeNG's viewport offsets using the central responsive toast variables. */
export const storyToastStyle = {
  top: 'var(--app-toast-top)',
  right: 'var(--app-toast-inset)',
  width: 'min(var(--p-toast-width), calc(100vw - 2 * var(--app-toast-inset)))',
};
