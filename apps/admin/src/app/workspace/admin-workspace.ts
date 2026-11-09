import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  NavigationSkipped,
  RouterOutlet,
  UrlSegment,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { PrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { OperationToast } from '../ui/operation-toast';
import { DemoSession } from '../core/auth/demo-session';
import { AdminConfig } from '../core/config/admin-config';
import { requestError } from '../core/graphql/request-error';
import { Login } from '../features/auth/login';
import { BranchContext } from '../features/branches/branch-context';
import { FleetPreferencesSession } from '../features/fleet/settings/fleet-preferences';
import {
  NotificationsApi,
  type NotificationsConnection,
} from '../features/notifications/notifications-api';
import {
  notificationRow,
  notificationTone,
} from '../features/notifications/notification-presentation';
import type { AdminNotificationsQuery } from '../../generated/graphql/operations';
import { messages, readLanguage, type Language } from '../i18n/messages';
import { AdminShell } from '../layout/admin-shell';
import type { LanguageOption, ShellNotification } from '../layout/admin-topbar';
import { navigationContext } from '../layout/navigation';
import { PageRecord } from '../layout/page-record';
import { UI_LANGUAGE } from '../ui/ui-language';
import { injectFleetFormat } from '../ui/format/fleet-format';
import type { LeavableDrawer } from '../ui/drawer/leave-drawer.guard';
import { adminNavigation } from './admin-navigation';
import { pageMetadata } from './page-metadata';
import { primeNgTranslation } from './primeng-translation';

function hasLeaveGuard(component: unknown): component is LeavableDrawer {
  return (
    component !== null &&
    typeof component === 'object' &&
    'canLeave' in component &&
    typeof component.canLeave === 'function'
  );
}

@Component({
  selector: 'discocan-admin-workspace',
  imports: [RouterOutlet, AdminShell, ButtonDirective, Message, Login, OperationToast],
  providers: [
    BranchContext,
    FleetPreferencesSession,
    MessageService,
    NotificationsApi,
    { provide: UI_LANGUAGE, useFactory: () => inject(AdminWorkspace).language },
  ],
  templateUrl: './admin-workspace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminWorkspace {
  readonly session = inject(DemoSession);
  readonly branches = inject(BranchContext);
  readonly fleetEnabled = inject(AdminConfig).fleetEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly primeNG = inject(PrimeNG);
  private readonly pageRecord = inject(PageRecord);
  private readonly operationMessages = inject(MessageService);
  private readonly notificationApi = inject(NotificationsApi);
  private readonly sessionToken = computed(() => this.session.current()?.token ?? null);
  readonly notificationConnection = signal<NotificationsConnection | null>(null);
  private readonly notificationPage = signal<AdminNotificationsQuery['notifications'] | null>(null);
  readonly notificationsLoading = signal(false);
  private readonly notificationError = signal<unknown>(null);
  readonly notificationsBusy = signal(false);
  readonly notificationsReadAllowed = computed(() => this.session.user() !== null);
  readonly notificationUnreadCount = computed(() => this.notificationPage()?.unreadCount ?? 0);
  readonly notificationFailure = computed(() =>
    this.notificationError()
      ? requestError(this.notificationError(), this.text().networkError)
      : null,
  );
  readonly notificationSeeAllLink = computed(() => {
    const branch = this.branches.selectedId();
    return branch ? ['/', this.language(), branch, 'fleet', 'notifications'] : null;
  });
  readonly bellNotifications = computed<readonly ShellNotification[] | null>(() => {
    const connection = this.notificationConnection();
    if (!connection) {
      return null;
    }
    return (this.notificationPage()?.items ?? []).map((item) => ({
      id: item.id,
      title: notificationRow(item, connection.language, connection.branchId).sentence,
      at: item.occurredAt,
      atTitle: this.format.utc(item.occurredAt),
      unread: item.readAt === null,
      category:
        item.category === 'ALERT' ? 'alert' : item.category === 'DEVICE' ? 'device' : 'command',
      tone: notificationTone(item.severity),
    }));
  });
  private readonly outlet = viewChild(RouterOutlet);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  readonly navigating = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError ||
          event instanceof NavigationSkipped,
      ),
      map((event) => event instanceof NavigationStart),
    ),
    { initialValue: this.router.currentNavigation() !== null },
  );
  readonly language = computed(() => readLanguage(this.params().get('language')));
  private readonly format = injectFleetFormat(undefined, this.language);
  readonly text = computed(() => messages[this.language()]);
  readonly branchFailure = computed(() =>
    requestError(this.branches.error(), this.text().networkError),
  );
  readonly otherLanguageUrl = computed(() => {
    this.navigationEnd();
    return this.languageLink(this.language() === 'bg' ? 'en' : 'bg');
  });
  /** The supported interface languages, each labelled in its own language. */
  readonly languages: readonly LanguageOption[] = [
    { code: 'bg', label: 'Български' },
    { code: 'en', label: 'English' },
  ];
  readonly navigation = computed(() =>
    adminNavigation(this.language(), this.branches.selectedId(), this.fleetEnabled),
  );
  /**
   * Explicit page metadata, falling back to the sidebar destination, and the record a page
   * registered.
   */
  readonly context = computed(() => {
    this.navigationEnd();
    const primary = this.router.parseUrl(this.router.url).root.children['primary'];
    const path = `/${(primary?.segments ?? []).map((segment) => segment.path).join('/')}`;
    const context =
      pageMetadata(this.language(), path) ?? navigationContext(this.navigation(), path);
    const pageLink = this.pageRecord.pageLink();
    return context
      ? { ...context, ...(pageLink ? { pageLink } : {}), record: this.pageRecord.label() }
      : null;
  });

  constructor() {
    effect((onCleanup) => {
      const token = this.sessionToken();
      const branchId = this.branches.selectedId();
      const language = this.language();
      this.notificationConnection.set(null);
      this.notificationPage.set(null);
      this.notificationError.set(null);
      this.notificationsBusy.set(false);
      if (!token || !branchId || !this.fleetEnabled) {
        this.notificationsLoading.set(false);
        return;
      }
      const connection = untracked(() => this.notificationApi.connect(branchId, language));
      this.notificationConnection.set(connection);
      this.notificationsLoading.set(true);
      const query = connection.watch({ offset: 0, limit: 5 }, true);
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.notificationsLoading.set(result.loading);
          this.notificationError.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error) {
            this.notificationPage.set(result.data.notifications);
          }
        },
        error: (error: unknown) => {
          this.notificationsLoading.set(false);
          this.notificationError.set(error);
        },
      });
      const visible = () => {
        if (!document.hidden) {
          connection.refresh();
        }
      };
      document.addEventListener('visibilitychange', visible);
      onCleanup(() => {
        document.removeEventListener('visibilitychange', visible);
        subscription.unsubscribe();
        connection.close();
      });
    });
    effect(() => {
      this.session.current();
      this.language();
      this.branches.selectedId();
      this.operationMessages.clear();
    });
    effect((onCleanup) => {
      const language = this.language();
      document.documentElement.lang = language;
      this.primeNG.setTranslation(primeNgTranslation(language, this.primeNG.translation.aria));
      const close = this.branches.watch(language);
      if (close) {
        onCleanup(close);
      }
    });
    effect(() => {
      this.branches.synchronizeRoute(this.language());
    });
    effect(() => {
      const text = this.text();
      const context = this.context();
      const page = this.session.current()
        ? [context?.tab, context?.record, context?.title ?? context?.page]
            .filter(Boolean)
            .join(' · ')
        : text.signIn;
      document.title = page ? `${page} · DiscoCan` : 'DiscoCan';
    });
  }

  async markNotificationsRead(id?: string): Promise<void> {
    const connection = this.notificationConnection();
    if (!connection || !this.notificationsReadAllowed() || this.notificationsBusy()) {
      return;
    }
    this.notificationsBusy.set(true);
    try {
      if (id) {
        await connection.markRead(id);
      } else {
        await connection.markAllRead();
      }
    } catch (error: unknown) {
      if (this.notificationConnection() === connection) {
        this.operationMessages.add({
          severity: 'error',
          summary: requestError(error, this.text().networkError),
          sticky: true,
        });
      }
    } finally {
      if (this.notificationConnection() === connection) {
        this.notificationsBusy.set(false);
      }
    }
  }

  openNotification(id: string): void {
    const connection = this.notificationConnection();
    const item = this.notificationPage()?.items.find((notification) => notification.id === id);
    if (!connection || !item) {
      return;
    }
    const row = notificationRow(item, connection.language, connection.branchId);
    if (item.readAt === null) {
      void this.markNotificationsRead(id);
    }
    const target = row.sourceLink ?? row.links[0];
    if (target) {
      void this.router.navigateByUrl(target.url);
    } else {
      const link = this.notificationSeeAllLink();
      if (link) {
        void this.router.navigate(link);
      }
    }
  }

  refreshNotifications(): void {
    this.notificationConnection()?.refresh();
  }

  async logout(): Promise<void> {
    // Route navigation runs the dirty-editor guard before retiring the session.
    const resumeDefaultNavigation = this.branches.pauseDefaultNavigation();
    try {
      if (await this.router.navigate(['/', this.language()])) {
        this.branches.clear();
        this.session.logout();
      }
    } finally {
      resumeDefaultNavigation();
    }
  }

  changeLanguage(code: string): void {
    if (code === 'bg' || code === 'en') {
      void this.router.navigateByUrl(this.languageLink(code));
    }
  }

  chooseBranch(id: string): Promise<void> {
    const outlet = this.outlet();
    const component: unknown = outlet?.isActivated ? outlet.component : null;
    return this.branches.choose(id, this.language(), hasLeaveGuard(component) ? component : null);
  }

  languageLink(language: Language) {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    if (primary) {
      primary.segments[0] = new UrlSegment(language, {});
    }
    return url;
  }
}
