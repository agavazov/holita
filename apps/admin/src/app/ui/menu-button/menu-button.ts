import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Check } from '@primeicons/angular/check';
import { ChevronDown } from '@primeicons/angular/chevron-down';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import type { StatusTone } from '../../theme/status-tones';
import { uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';

export interface MenuOption {
  readonly id: string;
  readonly label: string;
  /** The current choice of a single-choice menu (Branch, language): checked and announced. */
  readonly selected?: boolean;
  readonly disabled?: boolean;
  /** Destructive: last, after a separator, in the danger tone. */
  readonly danger?: boolean;
  /** The language of the label when it differs from the interface (language names). */
  readonly lang?: string;
  /** A second, muted line. */
  readonly description?: string;
  /** Short muted text at the end, e.g. a relative time. */
  readonly note?: string;
  /** A coloured dot before the label with its meaning for assistive technology, e.g. unread. */
  readonly marker?: { readonly tone: StatusTone; readonly label: string };
  /** Starts a new group after a separator (e.g. Sign out, Mark all as read). */
  readonly separated?: boolean;
}

/** The heading of the popup, e.g. the signed-in account on the account menu. */
export interface MenuHeader {
  readonly title: string;
  readonly detail?: string | null;
}

/** The chosen option and the trigger, which has the focus again when this is emitted. */
export interface MenuChoice {
  readonly id: string;
  readonly origin: HTMLElement;
}

let nextId = 0;

/**
 * A button that opens a menu of options in a popup: the row "⋮" menu and the topbar's Branch,
 * language, notification and account menus. The projected content is the trigger's face and,
 * without `ariaLabel`, its accessible name. Menus are for short option lists; a long list needs
 * a filterable picker instead.
 */
@Component({
  selector: 'holita-menu-button',
  imports: [Menu, Check, ChevronDown],
  templateUrl: './menu-button.html',
  styleUrl: './menu-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuButton {
  readonly options = input.required<readonly MenuOption[]>();
  /** The trigger's accessible name when its content does not give one (icon-only triggers). */
  readonly ariaLabel = input<string | null>(null);
  /** `icon`: a square icon button; `text`: a quiet button with its label and a chevron. */
  readonly variant = input<'icon' | 'text'>('icon');
  readonly header = input<MenuHeader | null>(null);
  /** Unavailable for now (e.g. still loading): stays focusable, does not open. */
  readonly disabled = input(false);
  /** Extra classes of the trigger button. */
  readonly buttonClass = input('');
  /** Extra classes of the popup, e.g. a wider panel. */
  readonly menuClass = input('');
  readonly choose = output<MenuChoice>();
  /** The popup opened, with keyboard focus on its current choice. */
  readonly opened = output();

  protected readonly id = `menu-button-${String(nextId++)}`;
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly current = computed(() => uiMessages[this.language()].menu.current);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild.required(Menu);
  protected readonly triggerClasses = computed(() =>
    [
      this.variant() === 'text' ? 'menu-button__text' : 'app-icon-button',
      'menu-button__trigger',
      this.buttonClass(),
    ]
      .filter(Boolean)
      .join(' '),
  );
  protected readonly popupClasses = computed(() =>
    ['menu-button__menu', this.menuClass()].filter(Boolean).join(' '),
  );
  /**
   * Danger options last after a separator; `separated` options start a group. No `id` or
   * `label`: p-menu then generates unique item IDs, and each item's accessible name comes from
   * the rendered content.
   */
  protected readonly items = computed<MenuItem[]>(() => {
    const toItem = (option: MenuOption): MenuItem => ({
      option,
      disabled: option.disabled ?? false,
      ...(option.danger ? { styleClass: 'app-menu-danger' } : {}),
      command: () => {
        const origin = this.trigger().nativeElement;
        origin.focus();
        this.choose.emit({ id: option.id, origin });
      },
    });
    const regular = this.options().filter((option) => !option.danger);
    const danger = this.options().filter((option) => option.danger);
    return [...regular, ...danger].flatMap((option, index, ordered): MenuItem[] => {
      const previous = ordered[index - 1];
      const separate =
        !!previous && (option.separated === true || (option.danger === true && !previous.danger));
      return separate ? [{ separator: true }, toItem(option)] : [toItem(option)];
    });
  });

  constructor() {
    // p-menu moves keyboard focus by aria-activedescendant only and never scrolls: keep the
    // focused option of a scrolling list (`app-menu-scroll`) in view.
    afterRenderEffect(() => {
      const menu = this.menu();
      const focused = menu.focusedOptionId();
      if (!menu.visible() || focused === null) return;
      this.document.getElementById(String(focused))?.scrollIntoView({ block: 'nearest' });
    });
  }

  protected toggle(event: Event): void {
    if (this.disabled()) return;
    this.menu().toggle(event);
  }

  /** Keyboard focus starts on the current choice, else on the first option. */
  protected shown(): void {
    const enabled = this.items().filter((item) => !item.separator && !item.disabled);
    const index = enabled.findIndex((item) => this.optionOf(item)?.selected);
    this.menu().changeFocusedOptionIndex(Math.max(index, 0));
    this.opened.emit();
  }

  protected optionOf(item: MenuItem): MenuOption | null {
    const option: unknown = item['option'];
    return isMenuOption(option) ? option : null;
  }
}

function isMenuOption(value: unknown): value is MenuOption {
  return typeof value === 'object' && value !== null && 'id' in value && 'label' in value;
}
