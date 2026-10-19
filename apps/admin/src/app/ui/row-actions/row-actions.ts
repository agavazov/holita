import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { EllipsisV } from '@primeicons/angular/ellipsis-v';
import { interpolate, uiMessages } from '../i18n/messages';
import type { ListActionBase, ListRecord } from '../list/list-actions';
import { type MenuChoice, MenuButton, type MenuOption } from '../menu-button/menu-button';
import { UI_LANGUAGE } from '../ui-language';

/** The chosen row action and the "⋮" button it came from (focused again). */
export interface RowChoice<A extends string> {
  readonly action: A;
  readonly origin: HTMLElement;
}

/**
 * The "⋮" menu of one list row: all of the list's actions in a popup, those that do not apply
 * to the record disabled, so lists never show a destructive button next to the data.
 */
@Component({
  selector: 'holita-row-actions',
  imports: [MenuButton, EllipsisV],
  template: `
    <holita-menu-button [ariaLabel]="label()" [options]="options()" (choose)="chosen($event)">
      <svg data-p-icon="ellipsis-v" aria-hidden="true"></svg>
    </holita-menu-button>
  `,
  styleUrl: './row-actions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RowActions<A extends string> {
  readonly actions = input.required<readonly ListActionBase<A>[]>();
  readonly record = input.required<ListRecord<A>>();
  readonly choose = output<RowChoice<A>>();

  private readonly language = inject(UI_LANGUAGE);
  protected readonly label = computed(() =>
    interpolate(uiMessages[this.language()].table.rowActions, { name: this.record().label }),
  );
  protected readonly options = computed<readonly MenuOption[]>(() =>
    this.actions().map((action) => ({
      id: action.id,
      label: action.label,
      danger: action.danger ?? false,
      disabled: this.record().unavailable.includes(action.id),
    })),
  );

  protected chosen(choice: MenuChoice): void {
    const action = this.actions().find((candidate) => candidate.id === choice.id);
    if (action) {
      this.choose.emit({ action: action.id, origin: choice.origin });
    }
  }
}
