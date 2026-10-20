import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type ActivatedRouteSnapshot,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { filter } from 'rxjs';
import { Drawer } from 'primeng/drawer';
import { Message } from 'primeng/message';
import { messages, type Language } from '../i18n/messages';
import { Appearance } from '../theme/appearance';
import { below } from '../ui/media';
import { AdminSidebar } from './admin-sidebar';
import {
  AdminTopbar,
  type LanguageOption,
  type ShellAccount,
  type ShellNotification,
} from './admin-topbar';
import type { NavGroup, PageContext } from './navigation';

const railStorageKey = 'holita.admin.sidebar';

function readRail(): boolean {
  try {
    return localStorage.getItem(railStorageKey) === 'rail';
  } catch {
    return false;
  }
}

/** Route config chain without drawer and tab routes: a change means a new page. */
function pageKey(root: ActivatedRouteSnapshot): string {
  const parts: string[] = [];
  let depth = 0;
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    const data = route.data;
    if (route.routeConfig && data['drawer'] !== true && data['tab'] !== true) {
      parts.push(`${String(depth)}:${route.routeConfig.path ?? ''}`);
    }
    depth++;
  }
  return parts.join('/');
}

/**
 * The application frame: canvas, sidebar (full, rail or mobile drawer), topbar and main content.
 * It reads no business data; navigation and the page context come from the workspace.
 */
@Component({
  selector: 'holita-admin-shell',
  imports: [Drawer, Message, AdminSidebar, AdminTopbar],
  templateUrl: './admin-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  readonly branches = input.required<readonly { id: string; name: string }[]>();
  readonly branchId = input<string | null>(null);
  readonly language = input.required<Language>();
  readonly languages = input<readonly LanguageOption[]>([]);
  readonly languageChange = output<string>();
  readonly loading = input(false);
  readonly tenantName = input<string | null>(null);
  /** The account menu's name and detail; the tenant name when absent. */
  readonly account = input<ShellAccount | null>(null);
  /** The bell's notifications; null hides the bell. */
  readonly notifications = input<readonly ShellNotification[] | null>(null);
  readonly notificationsUnavailable = input(false);
  readonly navigation = input<readonly NavGroup[]>([]);
  readonly context = input<PageContext | null>(null);
  readonly signOut = output();
  readonly branchSelected = output<string>();
  readonly notificationOpen = output<string>();
  readonly notificationsRead = output();

  readonly appearance = inject(Appearance);
  readonly mobile = below('lg');
  readonly rail = signal(readRail());
  readonly mobileOpen = signal(false);
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly homeLink = computed(() => {
    const branch = this.branchId();
    return branch ? ['/', this.language(), branch, 'fleet'] : ['/', this.language()];
  });
  protected readonly menuExpanded = computed(() =>
    this.mobile() ? this.mobileOpen() : !this.rail(),
  );
  private readonly topbar = viewChild.required(AdminTopbar);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  constructor() {
    // Reaching the desktop layout closes the navigation drawer and returns focus to the menu.
    effect(() => {
      if (!this.mobile() && untracked(this.mobileOpen)) {
        this.mobileOpen.set(false);
        afterNextRender(
          () => {
            this.topbar().focusMenu();
          },
          { injector: this.injector },
        );
      }
    });
    let page = pageKey(this.router.routerState.snapshot.root);
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (!(event instanceof NavigationEnd)) {
          return;
        }
        this.mobileOpen.set(false);
        const next = pageKey(this.router.routerState.snapshot.root);
        if (next !== page && event.id > 1) {
          afterNextRender(
            () => {
              this.focusPage();
            },
            { injector: this.injector },
          );
        }
        page = next;
      });
  }

  /** A known Branch other than the current one; the current one again is not a change. */
  chooseBranch(value: unknown): void {
    if (
      typeof value === 'string' &&
      value !== this.branchId() &&
      this.branches().some((branch) => branch.id === value)
    ) {
      this.branchSelected.emit(value);
    }
  }

  toggleNavigation(): void {
    if (this.mobile()) {
      this.mobileOpen.update((open) => !open);
      return;
    }
    this.rail.update((rail) => !rail);
    try {
      localStorage.setItem(railStorageKey, this.rail() ? 'rail' : 'full');
    } catch {
      // Storage failure only loses the preference.
    }
  }

  focusNavigation(): void {
    document.getElementById('mobile-navigation-close')?.focus();
  }

  drawerVisibilityChanged(visible: boolean): void {
    this.mobileOpen.set(visible);
    if (!visible) {
      this.topbar().focusMenu();
    }
  }

  /** After a page change: the page title, else the main region (unless the page took focus). */
  private focusPage(): void {
    const main = document.getElementById('main-content');
    if (!main || main.contains(document.activeElement)) {
      return;
    }
    (document.getElementById('page-title') ?? main).focus();
  }
}
