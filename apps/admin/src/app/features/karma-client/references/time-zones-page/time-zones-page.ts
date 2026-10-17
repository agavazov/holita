import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TableModule, type TablePageEvent } from 'primeng/table';
import type { AdminKarmaTimeZonesQuery } from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { KarmaApi } from '../../karma-api';
import { referenceListQuery } from '../../reference-list-query';

@Component({
  selector: 'holita-time-zones-page',
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Message, TableModule],
  providers: [KarmaApi],
  templateUrl: './time-zones-page.html',
  styleUrl: './time-zones-page.css',
})
export class TimeZonesPage {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly items = signal<AdminKarmaTimeZonesQuery['karmaTimeZones']>([]);
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
    return this.items().filter(
      (item) =>
        String(item.id).includes(q) || item.name.toLocaleLowerCase(this.language()).includes(q),
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
  private read: ReturnType<KarmaApi['watchTimeZones']> | undefined;

  constructor() {
    effect(() => {
      this.search.setValue(this.query().search, { emitEvent: false });
    });
    effect((onCleanup) => {
      this.api.initialize(this.language());
      const read = this.api.watchTimeZones();
      this.read = read;
      const subscription = read.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.items.set(result.data.karmaTimeZones);
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
