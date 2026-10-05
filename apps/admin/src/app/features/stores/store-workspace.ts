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
import { Shop } from '@primeicons/angular/shop';
import { ArrowRight } from '@primeicons/angular/arrow-right';
import { AdminShell } from '../../layout/admin-shell';
import type { AdminStoresQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, readLanguage, type Language } from '../../i18n/messages';
import { StoresApi } from './stores-api';

@Component({
  selector: 'holita-store-workspace',
  imports: [RouterLink, RouterOutlet, AdminShell, ButtonDirective, Message, Shop, ArrowRight],
  templateUrl: './store-workspace.html',
  styleUrl: './store-workspace.scss',
})
export class StoreWorkspace {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(StoresApi);
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
    void this.router.navigate(['/', this.language(), 'stores', id, 'products']);
  }

  languageLink(language: Language) {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    if (primary) primary.segments[0] = new UrlSegment(language, {});
    return url;
  }
}
