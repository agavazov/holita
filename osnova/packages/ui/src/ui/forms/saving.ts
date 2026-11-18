import { afterNextRender, effect, inject, Injector, untracked } from '@angular/core';
import type { AbstractControl } from '@angular/forms';

/** Locks a form during a save, retaining its draft and dirty/touched state on failure.
 * Use only with forms that do not independently disable individual controls.
 */
export function lockWhileSaving(
  form: AbstractControl,
  saving: () => boolean,
  settled: () => void,
): void {
  const injector = inject(Injector);
  let locked = false;
  effect(() => {
    const busy = saving();
    untracked(() => {
      if (busy === locked) {
        return;
      }
      locked = busy;
      if (busy) {
        form.disable();
        return;
      }
      form.enable();
      afterNextRender(settled, { injector });
    });
  });
}
