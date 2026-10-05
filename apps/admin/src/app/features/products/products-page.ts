import { Component, computed, DestroyRef, inject, input, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AdminProductsQuery, AdminStoresQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import { messages, type Language } from '../../i18n/messages';
import { ProductsApi } from './products-api';

@Component({
  selector: 'holita-products-page',
  providers: [ProductsApi],
  templateUrl: './products-page.html',
})
export class ProductsPage implements OnInit {
  readonly store = input.required<AdminStoresQuery['stores'][number]>();
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly api = inject(ProductsApi);
  private readonly destroyRef = inject(DestroyRef);
  private query: ReturnType<ProductsApi['watch']> | undefined;
  readonly page = signal<AdminProductsQuery['products'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));

  ngOnInit(): void {
    this.query = this.api.watch(this.store().id, this.language());
    this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete') this.page.set(result.data.products);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error);
      },
    });
  }

  refresh(): void {
    void this.query?.refetch().catch((error: unknown) => {
      this.error.set(error);
    });
  }
}
