import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  UrlSegment,
} from '@angular/router';
import type { AdminStoresQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, readLanguage, type Language } from '../../i18n/messages';
import { StoresApi } from './stores-api';

@Component({
  selector: 'holita-store-workspace',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './store-workspace.html',
})
export class StoreWorkspace {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(StoresApi);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private query: ReturnType<StoresApi['watch']> | undefined;
  readonly language = computed(() => readLanguage(this.params().get('language')));
  readonly text = computed(() => messages[this.language()]);
  readonly stores = signal<AdminStoresQuery['stores'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));

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
    void this.query?.refetch().catch((error: unknown) => {
      this.error.set(error);
    });
  }

  languageLink(language: Language) {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    if (primary) primary.segments[0] = new UrlSegment(language, {});
    return url;
  }
}
