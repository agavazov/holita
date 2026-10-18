import { InjectionToken, signal, type Signal } from '@angular/core';
import type { Language } from '../i18n/messages';

/**
 * The interface language for design-system components and pipes. AdminWorkspace provides its
 * route language; Storybook binds it to the `locale` toolbar global.
 */
export const UI_LANGUAGE = new InjectionToken<Signal<Language>>('UI language', {
  providedIn: 'root',
  factory: () => signal<Language>('bg').asReadonly(),
});
