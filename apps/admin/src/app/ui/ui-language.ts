import { InjectionToken, signal, type Signal } from '@angular/core';
import type { Language } from '../i18n/messages';

/**
 * The interface language for design-system components and pipes. AdminWorkspace provides its
 * route language; Storybook provides its configured story language.
 */
export const UI_LANGUAGE = new InjectionToken<Signal<Language>>('UI language', {
  providedIn: 'root',
  factory: () => signal<Language>('bg').asReadonly(),
});
