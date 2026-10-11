import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type { AdminKarmaCarsQuery } from '../../../../generated/graphql/operations';
import { messages, type Language } from '../../../i18n/messages';
import { KarmaCarsApi } from '../karma-cars-api';

@Component({
  selector: 'holita-karma-cars-page',
  imports: [ButtonDirective, Message, TableModule],
  providers: [KarmaCarsApi],
  templateUrl: './cars-page.html',
  styleUrl: './cars-page.css',
})
export class CarsPage {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly cars = signal<AdminKarmaCarsQuery['karmaCars']>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly loaded = signal(false);
  private readonly api = inject(KarmaCarsApi);
  private query: ReturnType<KarmaCarsApi['watch']> | undefined;

  constructor() {
    effect((onCleanup) => {
      this.api.initialize(this.language());
      const query = this.api.watch();
      this.query = query;
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.cars.set(result.data.karmaCars);
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
        this.query = undefined;
      });
    });
  }

  refresh(): void {
    if (this.loading()) return;
    this.error.set(false);
    const query = this.query;
    void query?.refetch().catch(() => {
      if (this.query === query) {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
