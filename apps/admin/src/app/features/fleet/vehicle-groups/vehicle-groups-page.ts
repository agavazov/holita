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
import {
  EMPTY,
  Subject,
  catchError,
  expand,
  filter,
  map,
  reduce,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminVehicleGroupDetailsFragment,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { messages, type Language } from '../../../i18n/messages';
import type { DrawerHost } from '../../../ui/drawer/drawer-host';
import { interpolate } from '../../../ui/i18n/messages';
import type { ListActionRequest } from '../../../ui/list/list-actions';
import { tableView } from '../../../ui/table-panel/table-view';
import { GroupsView, type GroupActionId } from '../settings/groups-view';
import { settingsText } from '../settings/i18n/messages';
import { vehicleGroupRow } from './vehicle-group-mapping';
import { VehicleGroupsApi } from './vehicle-groups-api';

/** The short group list displays every group; transport pages remain bounded. */
@Component({
  selector: 'holita-vehicle-groups-page',
  imports: [GroupsView, RouterOutlet],
  providers: [VehicleGroupsApi],
  template: `
    <holita-groups-view
      [rows]="rows()"
      [view]="view()"
      [busy]="loading() || acting()"
      [errorText]="failure()"
      [actionContext]="groups()"
      (create)="openEditor(null)"
      (action)="run($event)"
      (retry)="refresh()"
    />
    <router-outlet [routerOutletData]="drawerHost" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleGroupsPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  readonly api = inject(VehicleGroupsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(MessageService);
  private readonly reload = new Subject<void>();
  readonly groups = signal<readonly AdminVehicleGroupDetailsFragment[] | null>(null);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal<unknown>(null);
  protected readonly rows = computed(() => (this.groups() ?? []).map(vehicleGroupRow));
  readonly failure = computed(() =>
    requestError(this.error(), messages[this.language()].networkError),
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.groups() === null ? null : this.rows().length,
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
    const pageAt = (offset: number) =>
      this.api.watch({ offset, limit: 100 }).valueChanges.pipe(
        filter((result) => !result.loading),
        take(1),
        map((result) => {
          if (result.error) {
            throw result.error instanceof Error ? result.error : new Error(result.error.message);
          }
          if (result.dataState !== 'complete') {
            throw new Error('Missing vehicle groups.');
          }
          return result.data.fleetVehicleGroups;
        }),
      );
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return pageAt(0).pipe(
            expand((page) =>
              page.offset + page.items.length < page.total && page.items.length
                ? pageAt(page.offset + page.items.length)
                : EMPTY,
            ),
            reduce((all: AdminVehicleGroupDetailsFragment[], page) => [...all, ...page.items], []),
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      });
  }

  refresh(): void {
    this.reload.next();
  }

  openEditor(id: string | null): void {
    if (this.acting()) {
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
    if (!id || this.acting() || !this.current()) {
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
      this.groups.update((groups) => groups?.filter((group) => group.id !== id) ?? null);
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
