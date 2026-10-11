import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  NavigationEnd,
  RouterOutlet,
  UrlSegment,
} from '@angular/router';
import { filter } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { PrimeNG } from 'primeng/config';
import { Shop } from '@primeicons/angular/shop';
import { ArrowRight } from '@primeicons/angular/arrow-right';
import { AdminShell } from '../../layout/admin-shell';
import type { AdminStoresQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, readLanguage, type Language } from '../../i18n/messages';
import { StoresApi } from './stores-api';
import { AdminConfig } from '../../core/config/admin-config';

@Component({
  selector: 'holita-store-workspace',
  imports: [RouterLink, RouterOutlet, AdminShell, ButtonDirective, Message, Shop, ArrowRight],
  templateUrl: './store-workspace.html',
  styleUrl: './store-workspace.scss',
})
export class StoreWorkspace {
  readonly referenceEnabled = inject(AdminConfig).referenceEnabled;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(StoresApi);
  private readonly primeNG = inject(PrimeNG);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private query: ReturnType<StoresApi['watch']> | undefined;
  private readonly navigation = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  readonly language = computed(() => readLanguage(this.params().get('language')));
  readonly text = computed(() => messages[this.language()]);
  readonly stores = signal<AdminStoresQuery['stores'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly onStoreList = computed(() => {
    this.navigation();
    return !this.route.firstChild;
  });
  readonly showDiscovery = computed(
    () =>
      this.onStoreList() || this.stores() === null || this.stores()?.length === 0 || !!this.error(),
  );
  readonly storesAvailable = computed(() => (this.stores()?.length ?? 0) > 0);
  readonly selectedStoreId = computed(() => {
    this.navigation();
    const id = this.route.firstChild?.snapshot.paramMap.get('storeId')?.toLowerCase();
    return this.stores()?.find((store) => store.id === id)?.id ?? null;
  });
  readonly otherLanguageUrl = computed(() => {
    this.navigation();
    return this.languageLink(this.language() === 'bg' ? 'en' : 'bg');
  });

  constructor() {
    effect((onCleanup) => {
      const language = this.language();
      document.documentElement.lang = language;
      const text = messages[language];
      this.primeNG.setTranslation({
        monthNames: text.calendarMonths.split(','),
        monthNamesShort: text.calendarMonthsShort.split(','),
        dayNames: text.calendarDays.split(','),
        dayNamesShort: text.calendarDaysShort.split(','),
        dayNamesMin: text.calendarDaysMin.split(','),
        firstDayOfWeek: 1,
        chooseDate: text.calendarChooseDate,
        prevMonth: text.calendarPreviousMonth,
        nextMonth: text.calendarNextMonth,
        prevYear: text.calendarPreviousYear,
        nextYear: text.calendarNextYear,
        chooseMonth: text.calendarChooseMonth,
        chooseYear: text.calendarChooseYear,
        prevHour: text.calendarPreviousHour,
        nextHour: text.calendarNextHour,
        prevMinute: text.calendarPreviousMinute,
        nextMinute: text.calendarNextMinute,
        selectionMessage: text.selectedItemsMessage,
        emptySelectionMessage: text.emptySelectionMessage,
        aria: {
          ...this.primeNG.translation.aria,
          previous: text.previousSection,
          next: text.nextSection,
          firstPageLabel: text.firstPageLabel,
          prevPageLabel: text.prevPageLabel,
          nextPageLabel: text.nextPageLabel,
          lastPageLabel: text.lastPageLabel,
          pageLabel: text.pageLabel,
          rowsPerPageLabel: text.rowsPerPageLabel,
        },
      });
      const query = this.api.watch(language);
      this.query = query;
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.dataState === 'complete') this.stores.set(result.data.stores);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(error);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        this.query = undefined;
      });
    });
  }

  refresh(): void {
    const query = this.query;
    void query?.refetch().catch((error: unknown) => {
      if (this.query === query) this.error.set(error);
    });
  }

  chooseStore(id: string): void {
    const section = this.route.firstChild?.snapshot.url;
    const resource = section?.[3]?.path;
    const reference =
      this.referenceEnabled &&
      section?.[2]?.path === 'reference' &&
      (resource === 'venues' ||
        resource === 'speakers' ||
        resource === 'tags' ||
        resource === 'vehicles' ||
        resource === 'devices' ||
        resource === 'events');
    void this.router.navigate([
      '/',
      this.language(),
      'stores',
      id,
      ...(reference ? ['reference', resource] : ['products']),
    ]);
  }

  languageLink(language: Language) {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    if (primary) primary.segments[0] = new UrlSegment(language, {});
    return url;
  }
}
