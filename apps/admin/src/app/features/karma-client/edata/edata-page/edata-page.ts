import { Location } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import type { Subscription } from 'rxjs';
import type {
  AdminKarmaCarQuery,
  AdminKarmaEdataQuery,
  KarmaEdataInput,
} from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { KarmaEdataApi } from '../karma-edata-api';
import { edataFilters, positiveId } from './edata-filters';

type EdataPageResult = AdminKarmaEdataQuery['karmaEdata'];
type EdataMessage = EdataPageResult['items'][number];

@Component({
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonDirective,
    DialogModule,
    InputTextModule,
    Message,
    SelectModule,
    TableModule,
  ],
  providers: [KarmaEdataApi],
  selector: 'holita-edata-page',
  styleUrl: './edata-page.css',
  templateUrl: './edata-page.html',
})
export class EdataPage implements OnInit {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly car = signal<AdminKarmaCarQuery['karmaCar']>(null);
  readonly carLoaded = signal(false);
  readonly page = signal<EdataPageResult | null>(null);
  readonly selected = signal<EdataMessage | null>(null);
  readonly dialogVisible = signal(false);
  readonly carLoading = signal(false);
  readonly pageLoading = signal(false);
  readonly loading = computed(() => this.carLoading() || this.pageLoading());
  readonly error = signal(false);
  readonly invalidFilters = signal(false);
  readonly formError = signal(false);
  readonly previous = signal<(string | null)[]>([]);
  readonly validId = computed(() => positiveId(this.carId()));
  readonly pageSizes = [25, 50, 100];
  readonly form = new FormGroup({
    size: new FormControl(50, { nonNullable: true }),
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    parameters: new FormControl('', { nonNullable: true }),
  });
  private readonly api = inject(KarmaEdataApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private input: KarmaEdataInput | null = null;
  private carQuery: ReturnType<KarmaEdataApi['watchCar']> | undefined;
  private pageQuery: ReturnType<KarmaEdataApi['watch']> | undefined;
  private pageSubscription: Subscription | undefined;
  private trigger: HTMLElement | null = null;

  ngOnInit(): void {
    if (!this.validId()) {
      return;
    }
    this.api.initialize(this.language());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (
        this.route.snapshot.paramMap.get('recordId') !== this.carId() ||
        this.route.parent?.snapshot.paramMap.get('language') !== this.language() ||
        this.route.snapshot.data['edata'] !== true
      ) {
        return;
      }
      this.pageSubscription?.unsubscribe();
      this.pageQuery = undefined;
      this.page.set(null);
      this.selected.set(null);
      this.dialogVisible.set(false);
      this.pageLoading.set(false);
      this.error.set(false);
      this.formError.set(false);
      this.input = edataFilters(this.carId(), params);
      this.invalidFilters.set(this.input === null);
      this.form.reset({
        size: this.input?.pageSize ?? 50,
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
        parameters: params.get('parameters') ?? '',
      });
      this.restorePrevious();
      if (this.car()) {
        this.readPage();
      }
    });
    this.carLoading.set(true);
    this.carQuery = this.api.watchCar(this.carId());
    this.carQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.carLoading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.error) {
          this.car.set(result.data.karmaCar);
          this.carLoaded.set(true);
          if (this.car() && !this.pageQuery) {
            this.readPage();
          }
        }
      },
      error: () => {
        this.carLoading.set(false);
        this.error.set(true);
      },
    });
    this.destroyRef.onDestroy(() => {
      this.pageSubscription?.unsubscribe();
      this.pageQuery = undefined;
      this.carQuery = undefined;
    });
  }

  private readPage(): void {
    if (!this.input) {
      return;
    }
    const query = this.api.watch(this.input);
    this.pageQuery = query;
    this.pageLoading.set(true);
    this.pageSubscription = query.valueChanges.subscribe({
      next: (result) => {
        this.pageLoading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.error) {
          this.page.set(result.data.karmaEdata);
        }
      },
      error: () => {
        this.pageLoading.set(false);
        this.error.set(true);
      },
    });
  }

  refresh(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    const query = this.pageQuery ?? this.carQuery;
    void query?.refetch().catch(() => {
      if (query === this.pageQuery || query === this.carQuery) {
        this.carLoading.set(false);
        this.pageLoading.set(false);
        this.error.set(true);
      }
    });
  }

  apply(): void {
    const values = this.form.getRawValue();
    const params = {
      size: String(values.size),
      from: values.from,
      to: values.to,
      parameters: values.parameters.trim(),
    };
    const input = edataFilters(this.carId(), convertToParamMap(params));
    this.formError.set(input === null);
    if (!input) {
      return;
    }
    if (JSON.stringify(input) === JSON.stringify(this.input)) {
      this.refresh();
      return;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams: params });
  }

  reset(): void {
    this.form.reset({ size: 50, from: '', to: '', parameters: '' });
    this.apply();
  }

  older(): void {
    const cursor = this.page()?.nextCursor;
    if (!cursor || this.loading() || this.error()) {
      return;
    }
    this.navigate(cursor, [...this.previous(), this.page()?.cursor ?? this.input?.cursor ?? null]);
  }

  newer(): void {
    const history = this.previous();
    if (!history.length || this.loading()) {
      return;
    }
    this.navigate(history.at(-1) ?? null, history.slice(0, -1));
  }

  latest(): void {
    if (this.loading()) {
      return;
    }
    if (!this.input?.cursor) {
      this.refresh();
      return;
    }
    this.navigate(null, []);
  }

  private navigate(cursor: string | null, previous: (string | null)[]): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { cursor },
      state: { edataKey: this.historyKey(), edataPrevious: previous },
    });
  }

  private historyKey(): string {
    return JSON.stringify({ ...this.input, cursor: null });
  }

  private restorePrevious(): void {
    const state: unknown = this.location.getState();
    if (
      typeof state === 'object' &&
      state !== null &&
      'edataKey' in state &&
      state.edataKey === this.historyKey() &&
      'edataPrevious' in state &&
      Array.isArray(state.edataPrevious) &&
      state.edataPrevious.every(
        (value: unknown) =>
          value === null || (typeof value === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(value)),
      )
    ) {
      this.previous.set(
        state.edataPrevious.filter(
          (value: unknown): value is string | null => value === null || typeof value === 'string',
        ),
      );
    } else {
      this.previous.set([]);
    }
  }

  view(row: EdataMessage, event?: Event): void {
    this.trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.selected.set(row);
    this.dialogVisible.set(true);
  }

  closeDetails(): void {
    this.selected.set(null);
    if (this.trigger?.isConnected) {
      this.trigger.focus();
    }
    this.trigger = null;
  }
}
