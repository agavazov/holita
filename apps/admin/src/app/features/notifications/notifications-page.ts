import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap } from 'rxjs';
import type { AdminNotificationsQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages } from '../../i18n/messages';
import { FLEET_DISPLAY, defaultFleetDisplay } from '../../ui/format/fleet-format';
import type { ListQuery } from '../../ui/list/list-query';
import { normalizeSearch, sameListState, searchApplies } from '../../ui/list/list-state';
import { UrlListState } from '../../ui/list/url-list-state';
import { uiMessages } from '../../ui/i18n/messages';
import { AdminWorkspace } from '../../workspace/admin-workspace';
import { FleetPreferences } from '../fleet/settings/fleet-preferences';
import { GeneralSettingsApi } from '../fleet/settings/general-settings-api';
import { notificationRow } from './notification-presentation';
import type { NotificationsConnection } from './notifications-api';
import {
  notificationDefinition,
  notificationQueryState,
  notificationVariables,
  notificationViewQuery,
} from './notifications-query';
import { NotificationsView } from './notifications-view';

@Component({
  selector: 'holita-notifications-workspace',
  imports: [NotificationsView],
  providers: [
    GeneralSettingsApi,
    FleetPreferences,
    {
      provide: FLEET_DISPLAY,
      useFactory: () => {
        const preferences = inject(FleetPreferences);
        return computed(() => preferences.settings() ?? defaultFleetDisplay);
      },
    },
  ],
  templateUrl: './notifications-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsWorkspace implements OnInit {
  readonly connection = input.required<NotificationsConnection>();
  protected readonly workspace = inject(AdminWorkspace);
  protected readonly preferences = inject(FleetPreferences);
  private readonly destroyRef = inject(DestroyRef);
  readonly url = new UrlListState(notificationDefinition);
  private query: ReturnType<NotificationsConnection['watch']> | undefined;
  protected readonly page = signal<AdminNotificationsQuery['notifications'] | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<unknown>(null);
  protected readonly failure = computed(() =>
    requestError(this.error(), messages[this.connection().language].networkError),
  );
  protected readonly preferencesFailure = computed(() =>
    this.preferences.error()
      ? requestError(this.preferences.error(), messages[this.connection().language].networkError)
      : null,
  );
  protected readonly rows = computed(() =>
    (this.page()?.items ?? []).map((item) =>
      notificationRow(item, this.connection().language, this.connection().branchId),
    ),
  );
  protected readonly state = computed(() => ({
    ...notificationViewQuery(this.url.state()),
    search: this.url.searchDraft(),
  }));
  protected readonly searchError = computed(() => {
    const error = this.url.searchError();
    return error ? uiMessages[this.connection().language][error] : null;
  });

  ngOnInit(): void {
    const scope = this.connection();
    this.preferences.initialize(scope.branchId, scope.language);
    this.url.changes
      .pipe(
        switchMap((state) => {
          this.loading.set(true);
          this.error.set(null);
          this.query = scope.watch(notificationVariables(state));
          return this.query.valueChanges.pipe(
            catchError((error: unknown) => {
              this.error.set(error);
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          this.page.set(result.data.notifications);
          this.url.correctPage(
            Math.max(1, Math.ceil(result.data.notifications.total / this.url.state().pageSize)),
          );
        }
      });
  }

  protected changeState(query: ListQuery): void {
    const applied = this.url.state();
    const next = notificationQueryState(query);
    if (
      query.search !== this.url.searchDraft() &&
      sameListState(
        { ...next, search: applied.search, page: applied.page },
        applied,
        notificationDefinition,
      )
    ) {
      this.url.editSearch(query.search);
      return;
    }
    const search = searchApplies(query.search) ? normalizeSearch(query.search) : applied.search;
    this.url.setState({
      ...next,
      search,
      page: query.pageSize === applied.pageSize && search === applied.search ? query.page : 1,
    });
  }

  protected refresh(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) {
        this.error.set(error);
        this.loading.set(false);
      }
    });
  }
}

@Component({
  selector: 'holita-notifications-page',
  imports: [NotificationsWorkspace],
  template: `
    @for (scope of scopes(); track scope.token + ':' + scope.branchId + ':' + scope.language) {
      <holita-notifications-workspace [connection]="scope" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  private readonly workspace = inject(AdminWorkspace);
  protected readonly scopes = computed(() => {
    const connection = this.workspace.notificationConnection();
    return connection ? [connection] : [];
  });
}
