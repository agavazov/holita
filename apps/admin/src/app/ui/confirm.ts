import type { ConfirmationService } from 'primeng/api';
import type { ConfirmDialogPassThrough } from 'primeng/confirmdialog';
import type { Language } from '../i18n/messages';
import { uiMessages } from './i18n/messages';

/**
 * Pass-through for every `<p-confirmdialog>` host template: ConfirmDialog neither names its close
 * icon nor its `p-dialog` host (`role="alertdialog"`), so both are fixed here.
 * Usage: `<p-confirmdialog [pt]="confirmDialogPt(language)" />`.
 */
export function confirmDialogPt(language: Language): ConfirmDialogPassThrough {
  return {
    host: { role: 'none' },
    pcCloseButton: { root: { 'aria-label': uiMessages[language].close } },
  };
}

/** A destructive action (delete, deactivate) confirmed with focus on Cancel. */
export function confirmDestructive(
  confirmation: ConfirmationService,
  language: Language,
  options: {
    readonly header: string;
    readonly message: string;
    readonly acceptLabel: string;
    readonly trigger?: HTMLElement | null;
  },
): Promise<boolean> {
  const text = uiMessages[language];
  return new Promise((resolve) => {
    confirmation.confirm({
      ...(options.trigger ? { target: options.trigger } : {}),
      header: options.header,
      message: options.message,
      defaultFocus: 'reject',
      rejectButtonProps: { label: text.cancel, severity: 'secondary', outlined: true },
      acceptButtonProps: { label: options.acceptLabel, severity: 'danger' },
      accept: () => {
        resolve(true);
      },
      reject: () => {
        resolve(false);
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
