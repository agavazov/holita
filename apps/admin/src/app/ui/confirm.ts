import type { ConfirmationService } from 'primeng/api';
import type { ConfirmDialogPassThrough } from 'primeng/confirmdialog';
import type { Language } from '../i18n/messages';
import { uiMessages } from './i18n/messages';

/**
 * Pass-through for every `<p-confirmdialog>` host template: ConfirmDialog neither names its close
 * icon nor its `p-dialog` host (`role="alertdialog"`), so both are fixed here. Its dialog element
 * has no description either: a host with a `#message` template passes the ID of that content as
 * `describedBy`, so it is announced with the question.
 * Usage: `<p-confirmdialog [pt]="confirmDialogPt(language)" />`.
 */
export function confirmDialogPt(
  language: Language,
  describedBy?: string,
): ConfirmDialogPassThrough {
  return {
    host: { role: 'none' },
    // `root` reaches the element with `role="alertdialog"` (the inner p-dialog's container).
    ...(describedBy ? { root: { 'aria-describedby': describedBy } } : {}),
    pcCloseButton: { root: { 'aria-label': uiMessages[language].close } },
  };
}

/**
 * An action confirmed with focus on Cancel; the accept button has the danger tone for
 * destructive actions. `message` is rendered as HTML by ConfirmDialog, so it must never contain
 * record data: hosts that show records use the dialog's `#message` template instead.
 */
export function confirmAction(
  confirmation: ConfirmationService,
  language: Language,
  options: {
    readonly header: string;
    readonly message?: string;
    readonly acceptLabel: string;
    readonly danger: boolean;
    readonly signal?: AbortSignal;
  },
): Promise<boolean> {
  const text = uiMessages[language];
  return new Promise((resolve) => {
    const settle = (accepted: boolean) => {
      options.signal?.removeEventListener('abort', cancel);
      resolve(accepted);
    };
    const cancel = () => {
      confirmation.close();
      settle(false);
    };
    if (options.signal?.aborted) {
      settle(false);
      return;
    }
    options.signal?.addEventListener('abort', cancel, { once: true });
    confirmation.confirm({
      header: options.header,
      ...(options.message ? { message: options.message } : {}),
      defaultFocus: 'reject',
      closeOnEscape: true,
      rejectButtonProps: { label: text.cancel, severity: 'secondary', outlined: true },
      acceptButtonProps: {
        label: options.acceptLabel,
        severity: options.danger ? 'danger' : 'primary',
      },
      accept: () => {
        settle(true);
      },
      reject: () => {
        settle(false);
      },
    });
  });
}

/** Leaving an editor with unsaved changes; "keep editing" has the initial focus. */
export function confirmDiscard(
  confirmation: ConfirmationService,
  language: Language,
): Promise<boolean> {
  const text = uiMessages[language].discard;
  return new Promise((resolve) => {
    confirmation.confirm({
      header: text.title,
      message: text.message,
      defaultFocus: 'reject',
      closeOnEscape: true,
      rejectButtonProps: { label: text.keepEditing, severity: 'secondary', outlined: true },
      acceptButtonProps: { label: text.discard, severity: 'danger' },
      accept: () => {
        resolve(true);
      },
      reject: () => {
        resolve(false);
      },
    });
  });
}
