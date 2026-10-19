import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { RouterLink } from '@angular/router';
import type {
  AdminKarmaReferencesQuery,
  AdminKarmaCarsQuery,
} from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { KarmaApi } from '../../karma-api';

@Component({
  selector: 'holita-karma-cars-page',
  imports: [ButtonDirective, Message, TableModule, RouterLink],
  providers: [KarmaApi],
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
  readonly references = signal<AdminKarmaReferencesQuery | null>(null);
  readonly referencesError = signal(false);
  private referenceRead: ReturnType<KarmaApi['watchReferences']> | undefined;
  projectName(id: string): string {
    return this.references()?.karmaProjects.find((project) => project.id === id)?.name || '—';
  }
  timeZoneName(id: number | null | undefined): string {
    return this.references()?.karmaTimeZones.find((zone) => zone.id === id)?.name || '—';
  }
  private readonly api = inject(KarmaApi);
  private query: ReturnType<KarmaApi['watch']> | undefined;

  constructor() {
    effect((onCleanup) => {
      this.api.initialize(this.language());
      const references = this.api.watchReferences();
      this.referenceRead = references;
      const referenceSubscription = references.valueChanges.subscribe({
        next: (result) => {
          this.referencesError.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.references.set(result.data);
          }
        },
        error: () => {
          this.referencesError.set(true);
        },
      });
      onCleanup(() => {
        referenceSubscription.unsubscribe();
        this.referenceRead = undefined;
      });
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
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    const references = this.referenceRead;
    void references?.refetch().catch(() => {
      if (this.referenceRead === references) {
        this.referencesError.set(true);
      }
    });
    const query = this.query;
    void query?.refetch().catch(() => {
      if (this.query === query) {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
