import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  type IsActiveMatchOptions,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { PageHeader } from '../../../ui/page-header/page-header';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { FormField } from '../../../ui/form-field/form-field';
import { KarmaApi } from '../karma-api';
import type { AdminKarmaCarsQuery } from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { injectPageRecord } from '../../../layout/page-record';
import { karmaCarNavigationContext, karmaCarReturnQuery } from './karma-car-context';
import bg from './bg.json';
import en from './en.json';

const catalogs: Record<Language, typeof en> = { bg, en };

@Component({
  imports: [
    PageHeader,
    RouterLink,
    RouterLinkActive,
    ButtonDirective,
    FormsModule,
    Select,
    FormField,
  ],
  providers: [KarmaApi],
  selector: 'holita-karma-car-header',
  styleUrl: './karma-car-header.scss',
  templateUrl: './karma-car-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KarmaCarHeader {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly carNumber = input<string | null>();
  readonly title = input.required<string>();
  readonly canNavigate = input(true);
  readonly busy = input(false);
  readonly error = input(false);
  readonly refreshDisabled = input(false);
  readonly showRefresh = input(true);
  readonly showSourceIdentity = input(true);
  readonly refreshRequest = output();
  protected readonly text = computed(() => catalogs[this.language()]);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly query = toSignal(this.route.queryParams, {
    initialValue: this.route.snapshot.queryParams,
  });
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly returnQuery = computed(() => karmaCarReturnQuery(this.params()));
  protected readonly identity = computed(
    () =>
      this.carNumber() ||
      (this.showSourceIdentity() ? `${this.text().truck} · ${this.carId()}` : this.text().truck),
  );
  protected readonly description = computed(() =>
    this.showSourceIdentity() ? `${this.text().carId}: ${this.carId()}` : null,
  );
  protected readonly tabs = computed(() => [
    { path: '', label: this.text().overview },
    { path: 'trips', label: this.text().trips },
    { path: 'location', label: this.text().location },
    { path: 'events', label: this.text().events },
    { path: 'edata', label: this.text().edata },
    { path: 'diagnostics', label: this.text().diagnostics },
    { path: 'configuration', label: this.text().deviceSettings },
    { path: 'daily-report', label: this.text().dailyReport },
    { path: 'driving-profile', label: this.text().drivingProfile },
  ]);
  protected readonly sectionTitle = computed(
    () => this.tabs().find((tab) => this.isCurrent(tab.path))?.label ?? this.title(),
  );
  private readonly api = inject(KarmaApi);
  private readonly cars = signal<AdminKarmaCarsQuery['karmaCars']>([]);
  protected readonly switcherError = signal(false);
  protected readonly truckOptions = computed(() => {
    const cars = this.cars();
    return cars.some((car) => car.id === this.carId())
      ? cars
      : [{ id: this.carId(), carNumber: this.identity() }, ...cars];
  });
  private truckRead: ReturnType<KarmaApi['watch']> | undefined;

  protected switchTruck(id: string): void {
    if (id === this.carId() || !this.cars().some((car) => car.id === id)) {
      return;
    }
    const section = this.tabs().find((tab) => this.isCurrent(tab.path))?.path;
    void this.router.navigate(
      ['/', this.language(), 'karma-client', 'cars', id, ...(section ? [section] : [])],
      { queryParams: karmaCarNavigationContext(this.params()) },
    );
  }

  protected retryTrucks(): void {
    void this.truckRead?.refetch().catch(() => {
      this.switcherError.set(true);
    });
  }
  protected readonly activeMatch: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };

  constructor() {
    effect((onCleanup) => {
      this.api.initialize(this.language());
      const read = this.api.watch();
      this.truckRead = read;
      const subscription = read.valueChanges.subscribe({
        next: (result) => {
          this.switcherError.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.cars.set(result.data.karmaCars);
          }
        },
        error: () => {
          this.switcherError.set(true);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    injectPageRecord(
      () => this.carNumber() || null,
      () =>
        this.router.createUrlTree(['/', this.language(), 'karma-client', 'cars'], {
          queryParams: this.returnQuery(),
        }),
    );
  }

  protected destination(path: string) {
    const commands = ['/', this.language(), 'karma-client', 'cars', this.carId()];
    if (path) {
      commands.push(path);
    }
    return this.router.createUrlTree(commands, {
      queryParams: this.isCurrent(path) ? this.query() : karmaCarNavigationContext(this.params()),
      ...(this.isCurrent(path) ? { preserveFragment: true } : {}),
    });
  }

  private isCurrent(path: string): boolean {
    const segments = this.router.parseUrl(this.url()).root.children['primary']?.segments ?? [];
    const current = segments.at(-1)?.path;
    return path ? current === path : current === this.carId();
  }
}
