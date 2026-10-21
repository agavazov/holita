import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  type OnInit,
  afterNextRender,
  Injector,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { KarmaDateTime } from '../../date-time/karma-date-time';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type { Subscription } from 'rxjs';
import type {
  AdminKarmaCarQuery,
  AdminKarmaDrivingProfileQuery,
  KarmaDrivingProfileInput,
} from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { karmaRecordMessages } from '../../record-details/karma-record-messages';
import { karmaDateControl, karmaDateParameter } from '../../karma-date-time';
import { FormField } from '../../../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../../../ui/forms/focus';
import {
  karmaFilterErrors,
  karmaFilterFocusOrder,
  type KarmaFilterErrors,
} from '../../filter-validation/karma-filter-errors';
import { KarmaHistoryApi } from '../karma-history-api';
import { positiveId } from '../../edata/edata-page/edata-filters';
import { profileFilters, profilePeriod } from '../history-filters';
import { KarmaCarHeader } from '../../car-header/karma-car-header';
import { karmaCarNavigationContext } from '../../car-header/karma-car-context';
@Component({
  selector: 'holita-driving-profile-page',
  imports: [
    KarmaCarHeader,
    ReactiveFormsModule,
    FormField,
    ButtonDirective,
    KarmaDateTime,
    Message,
    TableModule,
  ],
  providers: [KarmaHistoryApi],
  templateUrl: './driving-profile-page.html',
  styleUrl: './driving-profile-page.css',
})
export class DrivingProfilePage implements OnInit {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly detailText = computed(() => karmaRecordMessages[this.language()]);
  readonly car = signal<AdminKarmaCarQuery['karmaCar']>(null);
  readonly carLoaded = signal(false);
  readonly profile = signal<AdminKarmaDrivingProfileQuery['karmaDrivingProfile']>(null);
  readonly loaded = signal(false);
  readonly appliedPeriod = signal<{ readonly from: string; readonly to: string } | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly invalidFilters = signal(false);
  readonly formError = signal(false);
  readonly fieldErrors = signal<KarmaFilterErrors>({});
  readonly validId = computed(() => positiveId(this.carId()));
  readonly form = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
  });
  private readonly defaults = profilePeriod();
  private readonly api = inject(KarmaHistoryApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('filterForm');
  private input: KarmaDrivingProfileInput | null = null;
  private carQuery: ReturnType<KarmaHistoryApi['watchCar']> | undefined;
  private query: ReturnType<KarmaHistoryApi['watchDrivingProfile']> | undefined;
  private subscription: Subscription | undefined;
  ngOnInit(): void {
    if (!this.validId()) {
      return;
    }
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.formError()) {
        this.fieldErrors.set(
          karmaFilterErrors('profile', this.form.getRawValue(), this.language()),
        );
      }
    });
    this.api.initialize(this.language());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (
        this.route.snapshot.paramMap.get('recordId') !== this.carId() ||
        this.route.parent?.snapshot.paramMap.get('language') !== this.language() ||
        this.route.snapshot.data['section'] !== 'driving-profile'
      ) {
        return;
      }
      this.subscription?.unsubscribe();
      this.query = undefined;
      this.profile.set(null);
      this.loaded.set(false);
      this.loading.set(false);
      this.error.set(false);
      this.formError.set(false);
      this.fieldErrors.set({});
      this.input = profileFilters(this.carId(), params, this.defaults);
      this.invalidFilters.set(this.input === null);
      this.appliedPeriod.set(
        this.input ? { from: this.input.fromDate, to: this.input.toDate } : null,
      );
      this.form.reset({
        from: karmaDateControl(params.get('from') ?? this.defaults.from),
        to: karmaDateControl(params.get('to') ?? this.defaults.to),
      });
      if (this.car()) {
        this.read();
      }
    });
    this.loading.set(true);
    this.carQuery = this.api.watchCar(this.carId());
    this.carQuery.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.error) {
          this.car.set(result.data.karmaCar);
          this.carLoaded.set(true);
          if (this.car() && !this.query) {
            this.read();
          }
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
    this.destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.query = undefined;
      this.carQuery = undefined;
    });
  }
  private read(): void {
    if (!this.input) {
      return;
    }
    this.query = this.api.watchDrivingProfile(this.input);
    this.loading.set(true);
    this.subscription = this.query.valueChanges.subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.error) {
          this.profile.set(result.data.karmaDrivingProfile);
          this.loaded.set(true);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
  refresh(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    const query = this.query ?? this.carQuery;
    void query?.refetch().catch(() => {
      if (query === this.query || query === this.carQuery) {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
  apply(): void {
    const values = this.form.getRawValue();
    const params = { from: karmaDateParameter(values.from), to: karmaDateParameter(values.to) };
    const input = profileFilters(this.carId(), convertToParamMap(params), this.defaults);
    this.formError.set(input === null);
    this.fieldErrors.set(
      input ? {} : karmaFilterErrors('profile', this.form.getRawValue(), this.language()),
    );
    if (!input) {
      afterNextRender(
        () => {
          const form = this.formElement()?.nativeElement;
          if (form) {
            focusFirstInvalid(form, karmaFilterFocusOrder, 'profile-');
          }
        },
        { injector: this.injector },
      );
      return;
    }
    if (JSON.stringify(input) === JSON.stringify(this.input)) {
      this.refresh();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...karmaCarNavigationContext(this.route.snapshot.queryParamMap), ...params },
    });
  }
  reset(): void {
    const period = profilePeriod();
    this.form.reset({ from: karmaDateControl(period.from), to: karmaDateControl(period.to) });
    this.apply();
  }
}
