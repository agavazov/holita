import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { KarmaApi } from '../../karma-api';
import { messages, type Language } from '../../../../i18n/messages';

@Component({
  selector: 'holita-api-info-page',
  imports: [ButtonDirective, Message],
  providers: [KarmaApi],
  templateUrl: './api-info-page.html',
  styleUrl: './api-info-page.css',
})
export class ApiInfoPage {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly version = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  private readonly api = inject(KarmaApi);
  private read: ReturnType<KarmaApi['watchVersion']> | undefined;
  constructor() {
    effect((onCleanup) => {
      this.api.initialize(this.language());
      const read = this.api.watchVersion();
      this.read = read;
      const subscription = read.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(!!result.error);
          if (result.dataState === 'complete' && !result.error)
            this.version.set(result.data.karmaVersion.version);
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
