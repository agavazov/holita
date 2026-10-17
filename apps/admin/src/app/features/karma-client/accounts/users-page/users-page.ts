import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { TableModule, type TablePageEvent } from 'primeng/table';
import type { AdminKarmaUsersQuery } from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { KarmaApi } from '../../karma-api';
import { referenceListQuery } from '../../reference-list-query';

@Component({
  selector: 'holita-users-page',
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Message, TableModule, Dialog],
  providers: [KarmaApi],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
})
export class UsersPage {
  readonly language = input.required<Language>();
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
  private trigger: HTMLElement | undefined;
  open(item: AdminKarmaUsersQuery['karmaUsers'][number], event: Event): void {
    this.trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    this.detail.set(item);
  }
  closeDetail(): void {
    this.detail.set(null);
  }
  restoreFocus(): void {
    this.trigger?.focus();
    this.trigger = undefined;
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
  page(event: TablePageEvent): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.query().search || null, size: event.rows, first: event.first || null },
    });
  }
  refresh(): void {
    if (this.loading()) return;
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
