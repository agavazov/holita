import { DestroyRef, inject, signal, type Signal } from '@angular/core';

export type BreakpointName = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/**
 * A breakpoint width in pixels, read from the `--app-bp-*` custom properties that
 * `styles/_breakpoint-properties.scss` generates from the single Sass map.
 */
function breakpointWidth(name: BreakpointName): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--app-bp-${name}`)
    .trim();
  const width = value.endsWith('px') ? Number(value.slice(0, -2)) : Number.NaN;
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('Global styles are not loaded');
  }
  return width;
}

/**
 * Whether the viewport is narrower than a breakpoint, matching the Sass `below($name)` mixin.
 * Call it in an injection context; the listener ends with the caller.
 */
export function below(name: BreakpointName): Signal<boolean> {
  const query = window.matchMedia(`(max-width: ${String(breakpointWidth(name) - 0.02)}px)`);
  const matches = signal(query.matches);
  const update = (event: MediaQueryListEvent) => {
    matches.set(event.matches);
  };
  query.addEventListener('change', update);
  inject(DestroyRef).onDestroy(() => {
    query.removeEventListener('change', update);
  });
  return matches.asReadonly();
}
