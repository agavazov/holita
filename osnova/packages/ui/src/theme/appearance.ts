import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';

export const THEME_STORAGE_KEY = new InjectionToken<string>('Theme storage key', {
  factory: () => 'osnova.ui.theme',
});
const darkQuery = '(prefers-color-scheme: dark)';

/** Light, dark, or automatic: the operating system's setting, which is the default. */
export type ThemeMode = 'light' | 'dark' | 'auto';
export const themeModes: readonly ThemeMode[] = ['light', 'dark', 'auto'];

@Injectable({ providedIn: 'root' })
export class Appearance {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = inject(THEME_STORAGE_KEY);
  readonly mode = signal<ThemeMode>('auto');
  private readonly systemDark = signal(false);
  readonly dark = computed(
    () => this.mode() === 'dark' || (this.mode() === 'auto' && this.systemDark()),
  );
  readonly persistenceFailed = signal(false);

  constructor() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      const mode = themeModes.find((value) => value === stored);
      if (mode) {
        this.mode.set(mode);
      }
    } catch {
      this.persistenceFailed.set(true);
    }
    const media = this.document.defaultView?.matchMedia(darkQuery);
    if (media) {
      this.systemDark.set(media.matches);
      media.addEventListener('change', (event) => {
        this.systemDark.set(event.matches);
        this.apply();
      });
    }
    this.apply();
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply();
    try {
      localStorage.setItem(this.storageKey, mode);
      this.persistenceFailed.set(false);
    } catch {
      this.persistenceFailed.set(true);
    }
  }

  private apply(): void {
    const dark = this.dark();
    this.document.documentElement.classList.toggle('app-dark', dark);
    this.document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }
}
