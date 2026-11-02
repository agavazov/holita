import { RouteDrawer } from '../../../../ui/drawer/route-drawer';
import { RowActions } from '../../../../ui/row-actions/row-actions';
import {
  listRecord,
  type ListAction,
  type ListActionRequest,
} from '../../../../ui/list/list-actions';
import { PageHeader } from '../../../../ui/page-header/page-header';
import { FormField } from '../../../../ui/form-field/form-field';
import { TablePanel } from '../../../../ui/table-panel/table-panel';
import { tableView } from '../../../../ui/table-panel/table-view';
import { karmaPresentation } from '../../presentation/karma-presentation';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import type { AdminKarmaUsersQuery } from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { KarmaApi } from '../../karma-api';
import { referenceListQuery } from '../../reference-list-query';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'holita-users-page',
  imports: [
    RouteDrawer,
    RowActions,
    PageHeader,
    FormField,
    TablePanel,
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    TableModule,
  ],
  providers: [KarmaApi],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
})
export class UsersPage {
  readonly language = input.required<Language>();
  readonly presentationText = computed(() => karmaPresentation[this.language()]);
  readonly text = computed(() => messages[this.language()]);
  readonly items = signal<AdminKarmaUsersQuery['karmaUsers']>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly loaded = signal(false);
  readonly search = new FormControl('', { nonNullable: true });
  readonly form = new FormGroup({ search: this.search });
  private readonly api = inject(KarmaApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly query = computed(() => referenceListQuery(this.params()));
  readonly filtered = computed(() => {
    const q = this.query().search.toLocaleLowerCase(this.language());
    return this.items().filter((item) =>
      [
        item.id,
        item.userName,
        item.firstName,
        item.lastName,
        item.email,
        item.roleId,
        item.projectId,
        ...item.projectIds,
        String(item.active),
        String(item.timeZoneId),
        item.expireDate ?? '',
      ].some((value) => value.toLocaleLowerCase(this.language()).includes(q)),
    );
  });
  readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error() ? true : null,
      rows: this.loaded() ? this.filtered().length : null,
      filtered: !!this.query().search,
    }),
  );
  readonly tablePage = computed(() => ({
    page: Math.floor(this.first() / this.query().rows) + 1,
    pageSize: this.query().rows,
    total: this.filtered().length,
  }));
  readonly first = computed(() =>
    this.loaded()
      ? Math.min(
          this.query().first,
          Math.max(0, Math.ceil(this.filtered().length / this.query().rows) - 1) *
            this.query().rows,
        )
      : this.query().first,
  );
  readonly detail = signal<AdminKarmaUsersQuery['karmaUsers'][number] | null>(null);
  readonly actions = computed<
    readonly ListAction<'view', AdminKarmaUsersQuery['karmaUsers'][number]>[]
  >(() => [{ id: 'view', label: this.text().view }]);
  record(item: AdminKarmaUsersQuery['karmaUsers'][number]) {
    return listRecord(this.actions(), item, item.id, item.userName || item.id);
  }
  open(request: ListActionRequest<'view'>): void {
    this.detail.set(this.items().find((item) => item.id === request.ids[0]) ?? null);
  }
  closeDetail(): void {
    this.detail.set(null);
  }
  private read: ReturnType<KarmaApi['watchUsers']> | undefined;

  constructor() {
    effect(() => {
      this.search.setValue(this.query().search, { emitEvent: false });
      this.detail.set(null);
    });
    effect((onCleanup) => {
      this.api.initialize(this.language());
      const read = this.api.watchUsers();
      this.read = read;
      const subscription = read.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.detail.set(null);
            this.items.set(result.data.karmaUsers);
            this.loaded.set(true);
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        this.read = undefined;
      });
    });
  }

  applySearch(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.search.value.trim() || null, size: this.query().rows, first: null },
    });
  }
  page(event: { page: number; pageSize: number }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.query().search || null,
        size: event.pageSize,
        first: (event.page - 1) * event.pageSize || null,
      },
    });
  }
  refresh(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    const read = this.read;
    void read?.refetch().catch(() => {
      if (this.read === read) {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
