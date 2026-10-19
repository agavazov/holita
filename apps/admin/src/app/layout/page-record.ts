import { computed, DestroyRef, inject, Injectable, type Signal, signal } from '@angular/core';

/**
 * The name of the record a page shows (a vehicle's plate on its profile), for the breadcrumb.
 * The page registers it; the composer (workspace) adds it to the shell's page context.
 */
@Injectable({ providedIn: 'root' })
export class PageRecord {
  private readonly current = signal<{ readonly label: Signal<string | null> } | null>(null);
  readonly label = computed(() => this.current()?.label() ?? null);

  /** Shows `label` until the returned function is called; a newer registration replaces it. */
  register(label: Signal<string | null>): () => void {
    const registration = { label };
    this.current.set(registration);
    return () => {
      // Only the page that registered last clears it, so a page leaving late keeps the new one.
      if (this.current() === registration) {
        this.current.set(null);
      }
    };
  }
}

/** For record pages: the record's name in the breadcrumb while the page is shown. */
export function injectPageRecord(label: () => string | null): void {
  const unregister = inject(PageRecord).register(computed(label));
  inject(DestroyRef).onDestroy(unregister);
}
