import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminUserDetailsFragment } from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { AdminConfig } from '../../core/config/admin-config';
import type { Language } from '../../i18n/messages';
import type { DrawerHost } from '../../ui/drawer/drawer-host';
import {
  FLEET_DISPLAY,
  defaultFleetDisplay,
  type FleetDisplayPreferences,
} from '../../ui/format/fleet-format';
import { interpolate } from '../../ui/i18n/messages';
import type { ListActionRequest } from '../../ui/list/list-actions';
import { tableView, type TableView } from '../../ui/table-panel/table-view';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { BranchContext } from '../branches/branch-context';
import { usersText } from './i18n/messages';
import { UsersApi } from './users-api';
import { UsersView, type UserActionId } from './users-view';

@Component({
  selector: 'holita-users-content',
  imports: [UsersView, RouterOutlet],
  providers: [
    UsersApi,
    { provide: FLEET_DISPLAY, useFactory: () => inject(UsersContent).displayPreferences },
  ],
  template: `
    <holita-users-view
      [rows]="users() ?? []"
      [view]="view()"
      [busy]="loading() || displayLoading() || acting()"
      [errorText]="failure()"
      [actionContext]="api.token"
      [canManage]="canManage()"
      (create)="openEditor(null)"
      (action)="run($event)"
      (retry)="retryRead()"
    />
    <router-outlet [routerOutletData]="drawerHost" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersContent implements OnInit {
  readonly language = input.required<Language>();
  readonly api = inject(UsersApi);
  readonly canManage = computed(() => this.session.hasRole('ADMINISTRATOR'));
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(DemoSession);
  private readonly branches = inject(BranchContext);
  private readonly fleetEnabled = inject(AdminConfig).fleetEnabled;
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(MessageService);
  private readonly reload = new Subject<void>();
  readonly users = signal<readonly AdminUserDetailsFragment[] | null>(null);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal<unknown>(null);
  readonly displayPreferences = signal<FleetDisplayPreferences>(defaultFleetDisplay);
  readonly displayLoading = signal(false);
  private readonly displayError = signal<unknown>(null);
  private readonly displayRetry = signal(0);
  private readonly text = computed(() => usersText(this.language()));
  readonly failure = computed(() =>
    this.displayError() ? this.text().preferencesError : this.text().errorText,
  );
  readonly view = computed<TableView>(() => {
    if (this.displayLoading()) {
      return { kind: 'loading' };
    }
    if (this.displayError()) {
      return { kind: 'error' };
    }
    return tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.users()?.length ?? null,
      filtered: false,
    });
  });
  readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      if (this.current()) {
        this.notifications.add({ severity: 'success', summary: message, life: 5000 });
        this.refresh();
      }
    },
  };

  constructor() {
    effect((onCleanup) => {
      const branchId = this.branches.selectedId();
      const language = this.language();
      this.displayRetry();
      this.displayPreferences.set(defaultFleetDisplay);
      this.displayError.set(null);
      this.displayLoading.set(this.fleetEnabled && branchId !== null);
      if (!this.fleetEnabled || !branchId) {
        return;
      }
      const { query, close } = this.api.watchDisplayPreferences(branchId, language);
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            this.failPreferences(result.error);
          } else if (result.dataState === 'complete' && !result.loading) {
            this.displayPreferences.set(result.data.fleetSettings);
            this.displayLoading.set(false);
          }
        },
        error: (error: unknown) => {
          this.failPreferences(error);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        close();
      });
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.language());
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.watch().valueChanges.pipe(
            catchError((error: unknown) => {
              this.failRead(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.failRead(result.error);
          return;
        }
        this.loading.set(result.loading);
        if (result.dataState === 'complete' && !result.loading) {
          this.users.set(result.data.users);
        }
      });
  }

  refresh(): void {
    this.reload.next();
  }

  retryRead(): void {
    if (this.displayError()) {
      this.displayRetry.update((attempt) => attempt + 1);
    } else {
      this.refresh();
    }
  }

  openEditor(id: string | null): void {
    if (this.acting() || !this.canManage()) {
      return;
    }
    void this.router.navigate(id ? [id, 'edit'] : ['new'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  async run({ action, ids }: ListActionRequest<UserActionId>): Promise<void> {
    const [id] = ids;
    if (!id || this.acting() || !this.current() || !this.canManage()) {
      return;
    }
    if (action === 'edit') {
      this.openEditor(id);
      return;
    }
    this.acting.set(true);
    try {
      const user =
        action === 'deactivate' ? await this.api.deactivate(id) : await this.api.reactivate(id);
      if (!this.current()) {
        return;
      }
      if (!user.active && user.id === this.session.user()?.id) {
        this.session.expire(this.api.token ?? undefined);
        return;
      }
      this.users.update(
        (users) => users?.map((existing) => (existing.id === id ? user : existing)) ?? null,
      );
      this.notifications.add({
        severity: 'success',
        summary: interpolate(
          action === 'deactivate' ? this.text().deactivated : this.text().reactivated,
          { name: user.name },
        ),
        life: 5000,
      });
    } catch (error: unknown) {
      if (this.current()) {
        this.notifications.add({
          severity: 'error',
          summary:
            CombinedGraphQLErrors.is(error) &&
            error.errors.some((failure) => failure.extensions?.['code'] === 'FORBIDDEN')
              ? this.text().administratorRequired
              : this.text().drawer.saveError,
          sticky: true,
        });
      }
    } finally {
      if (this.current()) {
        this.acting.set(false);
      }
    }
  }

  private failRead(error: unknown): void {
    this.loading.set(false);
    this.error.set(error);
    this.api.expireUnauthorized(error);
  }

  private failPreferences(error: unknown): void {
    this.displayLoading.set(false);
    this.displayError.set(error);
    this.api.expireUnauthorized(error);
  }

  private current(): boolean {
    return !this.destroyRef.destroyed && this.session.current()?.token === this.api.token;
  }
}

/** Account screens retire their clients on a session or language change without needing a Branch. */
@Component({
  selector: 'holita-users-page',
  imports: [UsersContent],
  template: `
    @for (scope of scopes(); track scope.key) {
      <holita-users-content [language]="scope.language" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly session = inject(DemoSession);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly scopes = computed(() => {
    const token = this.session.current()?.token;
    const language = this.language();
    return token ? [{ key: `${token}:${language}`, language }] : [];
  });
}
