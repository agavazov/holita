import { computed, DestroyRef, inject, Injectable, type Signal, signal } from '@angular/core';
import type { UrlTree } from '@angular/router';

/**
 * The name of the record a page shows (a vehicle's plate on its profile), for the breadcrumb.
 * The page registers it; the composer (workspace) adds it to the shell's page context.
 */
@Injectable({ providedIn: 'root' })
export class PageRecord {
  private readonly current = signal<{
    readonly label: Signal<string | null>;
    readonly pageLink: Signal<UrlTree> | null;
  } | null>(null);
  readonly label = computed(() => this.current()?.label() ?? null);
  readonly pageLink = computed(() => this.current()?.pageLink?.() ?? null);

  /** Shows `label` until the returned function is called; a newer registration replaces it. */
  register(label: Signal<string | null>, pageLink: Signal<UrlTree> | null = null): () => void {
    const registration = { label, pageLink };
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
export function injectPageRecord(label: () => string | null, pageLink?: () => UrlTree): void {
  const unregister = inject(PageRecord).register(
    computed(label),
    pageLink ? computed(pageLink) : null,
  );
  inject(DestroyRef).onDestroy(unregister);
}
