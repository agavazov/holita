import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { EllipsisV } from '@primeicons/angular/ellipsis-v';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { interpolate, uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

export interface RowAction {
  readonly id: string;
  readonly label: string;
  /** Destructive actions come last, after a separator, in the danger tone. */
  readonly danger?: boolean;
  readonly disabled?: boolean;
}

/**
 * The "⋮" menu of one list row: the row's actions open in a popup, so lists never show a
 * destructive button directly next to the data.
 */
@Component({
  selector: 'holita-row-actions',
  imports: [Menu, EllipsisV],
  templateUrl: './row-actions.html',
  styleUrl: './row-actions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RowActions {
  readonly actions = input.required<readonly RowAction[]>();
  /** What the row is, for the accessible name, e.g. the licence plate. */
  readonly subject = input.required<string>();
  readonly action = output<string>();

  protected readonly open = signal(false);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly label = computed(() =>
    interpolate(uiMessages[this.language()].table.rowActions, { name: this.subject() }),
  );
  protected readonly items = computed<MenuItem[]>(() => {
    const toItem = (action: RowAction): MenuItem => ({
      id: action.id,
      label: action.label,
      disabled: action.disabled ?? false,
      ...(action.danger ? { styleClass: 'app-menu-danger' } : {}),
      command: () => {
        this.action.emit(action.id);
      },
    });
    const regular = this.actions().filter((action) => !action.danger);
    const danger = this.actions().filter((action) => action.danger);
    return [
      ...regular.map(toItem),
      ...(regular.length && danger.length ? [{ separator: true }] : []),
      ...danger.map(toItem),
    ];
  });
}
