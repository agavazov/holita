import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

const storageKey = 'holita.admin.theme';

@Injectable({ providedIn: 'root' })
export class Appearance {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);
  readonly persistenceFailed = signal(false);

  constructor() {
    try {
      this.dark.set(localStorage.getItem(storageKey) === 'dark');
    } catch {
      this.persistenceFailed.set(true);
    }
    this.apply();
  }

  toggle(): void {
    this.dark.update((dark) => !dark);
    this.apply();
    try {
      localStorage.setItem(storageKey, this.dark() ? 'dark' : 'light');
      this.persistenceFailed.set(false);
    } catch {
      this.persistenceFailed.set(true);
    }
  }

  private apply(): void {
    this.document.documentElement.classList.toggle('app-dark', this.dark());
    this.document.documentElement.style.colorScheme = this.dark() ? 'dark' : 'light';
  }
}
