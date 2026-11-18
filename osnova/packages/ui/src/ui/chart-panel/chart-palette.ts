import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, type ElementRef, inject, signal } from '@angular/core';
import { categorySlots, statusToneNames } from '../../theme/status-tones';

export interface ChartPalette {
  readonly categories: readonly string[];
  readonly tones: readonly string[];
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  readonly background: string;
}

/** Canvas needs resolved colours: CSS variables may contain light-dark() or color-mix(). */
export function injectChartPalette(host: ElementRef<HTMLElement>) {
  const document = inject(DOCUMENT);
  const destroy = inject(DestroyRef);
  const palette = signal<ChartPalette | null>(null, {
    equal: (previous, next) => JSON.stringify(previous) === JSON.stringify(next),
  });
  const reducedMotion = signal(true);

  afterNextRender(() => {
    const view = document.defaultView;
    if (!view) {
      return;
    }
    const probe = document.createElement('span');
    probe.hidden = true;
    host.nativeElement.append(probe);
    const resolve = (token: string) => {
      probe.style.color = `var(${token})`;
      return view.getComputedStyle(probe).color;
    };
    const read = () => {
      palette.set({
        categories: categorySlots.map((slot) => resolve(`--p-app-category-${slot}`)),
        tones: statusToneNames.map((tone) => resolve(`--p-app-tone-${tone}-solid`)),
        text: resolve('--p-text-color'),
        muted: resolve('--p-text-muted-color'),
        border: resolve('--p-content-border-color'),
        background: resolve('--p-content-background'),
      });
    };
    let frame = 0;
    const schedule = () => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(read);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    // PrimeUI replaces generated style elements when a preset/brand changes.
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      reducedMotion.set(motion.matches);
    };
    motion.addEventListener('change', updateMotion);
    updateMotion();
    read();
    destroy.onDestroy(() => {
      observer.disconnect();
      view.cancelAnimationFrame(frame);
      motion.removeEventListener('change', updateMotion);
      probe.remove();
    });
  });

  return { palette: palette.asReadonly(), reducedMotion: reducedMotion.asReadonly() };
}
