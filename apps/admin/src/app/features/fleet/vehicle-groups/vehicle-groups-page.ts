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
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminVehicleGroupsListQuery,
} from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { interpolate } from '../../../ui/i18n/messages';
import type { ListActionRequest } from '../../../ui/list/list-actions';
import type { ListDefinition } from '../../../ui/list/list-state';
import { UrlListState } from '../../../ui/list/url-list-state';
import { tableView } from '../../../ui/table-panel/table-view';
import { GroupsView, type GroupActionId } from '../settings/groups-view';
import { settingsText } from '../settings/i18n/messages';
import { vehicleGroupRow } from './vehicle-group-mapping';
import { VehicleGroupsApi } from './vehicle-groups-api';

const groupDefinition: ListDefinition<Record<string, never>, 'name'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [{ param: 'name', field: 'name' }],
  defaultSort: { field: 'name', direction: 'ASC' },
  filters: {},
};

/** A bounded group page; the existing operation keeps its supported name ordering. */
@Component({
  selector: 'holita-vehicle-groups-page',
  imports: [GroupsView, RouterOutlet],
  providers: [VehicleGroupsApi],
  template: `
    <holita-groups-view
      [rows]="rows()"
      [page]="pagination()"
      [view]="view()"
      [busy]="loading() || acting()"
      [canEdit]="canOperate()"
      [errorText]="failure()"
      [actionContext]="url.state()"
      (create)="openEditor(null)"
      (action)="run($event)"
      (retry)="refresh()"
      (pageChange)="url.setPage($event)"
    />
    <router-outlet [routerOutletData]="drawerHost" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleGroupsPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(VehicleGroupsApi);
  readonly url = new UrlListState(groupDefinition);
  private readonly session = inject(DemoSession);
  protected readonly canOperate = computed(() => this.session.hasRole('OPERATOR'));
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(MessageService);
  private readonly reload = new Subject<void>();
  readonly page = signal<AdminVehicleGroupsListQuery['fleetVehicleGroups'] | null>(null);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal<unknown>(null);
  protected readonly rows = computed(() => (this.page()?.items ?? []).map(vehicleGroupRow));
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page() === null ? null : this.rows().length,
      filtered: false,
    }),
  );
  private readonly text = computed(() => settingsText(this.language()).groups);
  readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      if (!this.destroyRef.destroyed) {
        this.notifications.add({ severity: 'success', summary: message, life: 5000 });
        this.refresh();
      }
    },
  };

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
    this.url.changes
      .pipe(
        switchMap((state) => {
          return this.reload.pipe(
            startWith(undefined),
            switchMap(() => {
              this.loading.set(true);
              this.error.set(null);
              return this.api
                .watch({ offset: (state.page - 1) * state.pageSize, limit: state.pageSize })
                .valueChanges.pipe(
                  catchError((error: unknown) => {
                    this.loading.set(false);
                    this.error.set(error);
                    return EMPTY;
                  }),
                );
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState !== 'complete' || result.error || result.loading) {
          return;
        }
        const page = result.data.fleetVehicleGroups;
        this.page.set(page);
        this.url.correctPage(Math.max(1, Math.ceil(page.total / this.url.state().pageSize)));
      });
  }

  refresh(): void {
    this.reload.next();
  }

  openEditor(id: string | null): void {
    if (!this.canOperate() || this.acting()) {
      return;
    }
    void this.router.navigate(id ? [id, 'edit'] : ['new'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  async run({ action, ids }: ListActionRequest<GroupActionId>): Promise<void> {
    const [id] = ids;
    if (!this.canOperate() || !id || this.acting() || !this.current()) {
      return;
    }
    if (action === 'edit') {
      this.openEditor(id);
      return;
    }
    this.acting.set(true);
    try {
      await this.api.delete({ id });
      if (!this.current()) {
        return;
      }
      this.page.update((page) =>
        page
          ? { ...page, items: page.items.filter((group) => group.id !== id), total: page.total - 1 }
          : null,
      );
      this.notifications.add({
        severity: 'success',
        summary: interpolate(this.text().deleted, { count: 1 }),
        life: 5000,
      });
      this.refresh();
    } catch (error: unknown) {
      if (this.current()) {
        this.notifications.add({
          severity: 'error',
          summary: requestError(error, messages[this.language()].networkError),
          sticky: true,
        });
      }
    } finally {
      if (this.current()) {
        this.acting.set(false);
      }
    }
  }
  private current(): boolean {
    return !this.destroyRef.destroyed;
  }
}
