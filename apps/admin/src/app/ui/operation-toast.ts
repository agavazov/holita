import { ChangeDetectionStrategy, Component, computed, inject, isSignal } from '@angular/core';
import { Check } from '@primeicons/angular/check';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { InfoCircle } from '@primeicons/angular/info-circle';
import { Times } from '@primeicons/angular/times';
import { TimesCircle } from '@primeicons/angular/times-circle';
import { Toast, type ToastPassThrough } from 'primeng/toast';
import { uiMessages } from './i18n/messages';
import { UI_LANGUAGE } from './ui-language';

/** Shared operation feedback: announcements retain focus on the user's active control. */
@Component({
  selector: 'holita-operation-toast',
  imports: [Toast, Check, ExclamationTriangle, InfoCircle, Times, TimesCircle],
  templateUrl: './operation-toast.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationToast {
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()]);
  protected readonly style = {
    top: 'var(--app-toast-top)',
    right: 'var(--app-toast-inset)',
    width: 'min(var(--p-toast-width), calc(100vw - 2 * var(--app-toast-inset)))',
  };
  protected readonly pt: ToastPassThrough = {
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
}
