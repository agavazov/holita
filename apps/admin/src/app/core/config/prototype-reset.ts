import { InjectionToken } from '@angular/core';

export const PROTOTYPE_RESET = new InjectionToken<(() => void | Promise<void>) | null>(
  'Prototype Reset',
  {
    providedIn: 'root',
    factory: () => null,
  },
);
