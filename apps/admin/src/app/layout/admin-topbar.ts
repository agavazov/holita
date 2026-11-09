import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Bars } from '@primeicons/angular/bars';
import { ChevronRight } from '@primeicons/angular/chevron-right';
import { InfoCircle } from '@primeicons/angular/info-circle';
import { messages, type Language } from '../i18n/messages';
import { Appearance } from '../theme/appearance';
import { interpolate, uiMessages } from '../ui/i18n/messages';
import { ModuleInfo } from '../ui/page-header/module-info';
import { MenuButton, type MenuOption } from '../ui/menu-button/menu-button';
import type { PageContext } from './navigation';
import { ACCOUNT_MENU_CONTEXT } from './account-menu-context';
import { NotificationBell, type ShellNotification } from './notification-bell';

export type { ShellNotification } from './notification-bell';

/** One entry of the interface-language menu, labelled in its own language. */
export interface LanguageOption {
  readonly code: string;
  readonly label: string;
}

/** The signed-in account shown on the account menu. */
export interface ShellAccount {
  readonly name: string;
  readonly detail?: string | null;
}

/**
 * Menu/rail toggle, breadcrumb, Branch and language menus, notifications and the account menu
 * (theme, sign out). The topbar reads no business data.
 */
@Component({
  selector: 'holita-admin-topbar',
  imports: [RouterLink, MenuButton, NotificationBell, Bars, ChevronRight, InfoCircle],
  templateUrl: './admin-topbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTopbar {
  readonly language = input.required<Language>();
  /** The menu is shown only when there is more than one language to choose from. */
  readonly languages = input<readonly LanguageOption[]>([]);
  readonly languageChange = output<string>();
  readonly context = input<PageContext | null>(null);
  readonly branches = input.required<readonly { id: string; name: string }[]>();
  readonly branchId = input<string | null>(null);
  readonly branchChange = output<string>();
  readonly loading = input(false);
  readonly tenantName = input<string | null>(null);
  readonly account = input<ShellAccount | null>(null);
  /** Null hides the bell. */
  readonly notifications = input<readonly ShellNotification[] | null>(null);
  readonly notificationUnreadCount = input(0);
  readonly notificationsLoading = input(false);
  readonly notificationsError = input<string | null>(null);
  readonly notificationsReadAllowed = input(true);
  readonly notificationsBusy = input(false);
  readonly notificationSeeAllLink = input<readonly string[] | null>(null);
  readonly notificationOpen = output<string>();
  readonly notificationsRead = output();
  readonly notificationsRetry = output();
  readonly homeLink = input.required<readonly string[]>();
  readonly showLogo = input(false);
  readonly menuExpanded = input(false);
  readonly menuControls = input.required<string>();
  readonly menuToggle = output();
  readonly signOut = output();

  protected readonly appearance = inject(Appearance);
  protected readonly moduleInfo = inject(ModuleInfo);
  protected readonly aboutLabel = computed(() => uiMessages[this.language()].pageHeader.about);
  private readonly accountContext = inject(ACCOUNT_MENU_CONTEXT, { optional: true });
  private readonly router = inject(Router);
  protected readonly text = computed(() => messages[this.language()]);
  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');

  /** Without Branches the menu is disabled and its label says why. */
  protected readonly branchLabel = computed(() => {
    if (!this.branches().length) {
      return this.loading() ? this.text().loadingBranches : this.text().emptyBranches;
    }
    return (
      this.branches().find((branch) => branch.id === this.branchId())?.name ?? this.text().branches
    );
  });
  protected readonly branchOptions = computed<readonly MenuOption[]>(() =>
    this.branches().map((branch) => ({
      id: branch.id,
      label: branch.name,
      selected: branch.id === this.branchId(),
    })),
  );
  protected readonly currentLanguage = computed(
    () =>
      this.languages().find((option) => option.code === this.language()) ?? {
        code: this.language(),
        label: this.language().toUpperCase(),
      },
  );
  protected readonly languageOptions = computed<readonly MenuOption[]>(() =>
    this.languages().map((option) => ({
      id: option.code,
      label: option.label,
      lang: option.code,
      selected: option.code === this.language(),
    })),
  );
  protected readonly accountName = computed(
    () => this.account()?.name ?? this.accountContext?.()?.name ?? this.tenantName() ?? 'holita',
  );
  protected readonly accountLabel = computed(() =>
    interpolate(this.text().account, { name: this.accountName() }),
  );
  protected readonly accountHeader = computed(() => ({
    title: this.accountName(),
    detail: this.account()?.detail ?? this.accountContext?.()?.detail ?? null,
  }));
  protected readonly initials = computed(() =>
    this.accountName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] ?? '')
      .join('')
      .toLocaleUpperCase(this.language()),
  );
  protected readonly accountOptions = computed<readonly MenuOption[]>(() => [
    {
      id: 'profile',
      label: this.text().profile,
      link: this.router.createUrlTree(['/', this.language(), 'profile']),
    },
    {
      id: 'theme',
      label: this.appearance.dark() ? this.text().lightTheme : this.text().darkTheme,
    },
    { id: 'sign-out', label: this.text().signOut, separated: true },
  ]);

  focusMenu(): void {
    this.menuButton().nativeElement.focus();
  }

  /** Choosing the current Branch again is not a change (it would reload the page). */
  protected chooseBranch(id: string): void {
    if (id !== this.branchId()) {
      this.branchChange.emit(id);
    }
  }

  protected chooseLanguage(code: string): void {
    if (code !== this.language()) {
      this.languageChange.emit(code);
    }
  }

  protected chooseAccount(id: string): void {
    if (id === 'theme') {
      this.appearance.toggle();
    }
    if (id === 'sign-out') {
      this.signOut.emit();
    }
  }
}
