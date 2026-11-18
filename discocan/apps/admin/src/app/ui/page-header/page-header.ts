import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink, type Params } from '@angular/router';
import { ArrowLeft } from '@primeicons/angular/arrow-left';
import { EllipsisH } from '@primeicons/angular/ellipsis-h';
import { ButtonDirective } from 'primeng/button';
import { formatNumber } from '../format/format';
import { uiMessages } from '../i18n/messages';
import { MenuButton, type MenuChoice, type MenuOption } from '../menu-button/menu-button';
import { UI_LANGUAGE } from '../ui-language';
import { ModuleInfo } from './module-info';

export interface PageHeaderAction extends MenuOption {
  readonly primary?: boolean;
  readonly loading?: boolean;
}

/** Page title, count, one primary action and the complete page-action menu. */
@Component({
  selector: 'discocan-page-header',
  imports: [RouterLink, ArrowLeft, EllipsisH, ButtonDirective, MenuButton],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly count = input<number | null>(null);
  readonly moduleInfo = input<string | null>(null);
  readonly moduleInfoTitle = input<string | null>(null);
  readonly actions = input<readonly PageHeaderAction[]>([]);
  readonly action = output<MenuChoice>();
  readonly backLink = input<readonly string[] | null>(null);
  readonly backLabel = input<string | null>(null);
  readonly backQueryParams = input<Params | null>(null);
  readonly backFragment = input<string | null>(null);

  private readonly language = inject(UI_LANGUAGE);
  protected readonly info = inject(ModuleInfo);
  protected readonly text = computed(() => uiMessages[this.language()].pageHeader);
  protected readonly primaryAction = computed(() =>
    this.actions().find((action) => action.primary),
  );
  protected readonly menuOptions = computed<readonly MenuOption[]>(() =>
    this.actions().map((action) => ({
      ...action,
      disabled: action.disabled || action.loading || false,
    })),
  );
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  protected readonly countText = computed(() => {
    const count = this.count();
    return count === null ? null : formatNumber(count, this.language());
  });

  constructor() {
    effect((onCleanup) => {
      const body = this.moduleInfo();
      this.info.set(body ? { title: this.moduleInfoTitle() ?? this.title(), body } : null);
      onCleanup(() => {
        this.info.set(null);
      });
    });
  }

  protected choose(choice: MenuChoice): void {
    this.action.emit(choice);
  }

  protected runPrimary(action: PageHeaderAction, event: Event): void {
    if (event.currentTarget instanceof HTMLElement) {
      this.action.emit({ id: action.id, origin: event.currentTarget });
    }
  }

  focusTitle(): void {
    this.heading().nativeElement.focus();
  }
}
