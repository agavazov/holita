import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Desktop } from '@primeicons/angular/desktop';
import { Moon } from '@primeicons/angular/moon';
import { Sun } from '@primeicons/angular/sun';
import { Appearance, themeModes } from '../../theme/appearance';
import { uiMessages } from '../i18n/messages';
import { MenuButton, type MenuOption } from '../menu-button/menu-button';
import { UI_LANGUAGE } from '../ui-language';

/** The light, dark or automatic theme behind one icon; automatic follows the system. */
@Component({
  selector: 'discocan-theme-menu',
  imports: [MenuButton, Desktop, Moon, Sun],
  template: `
    <discocan-menu-button [ariaLabel]="label()" [options]="options()" (choose)="choose($event.id)">
      @switch (appearance.mode()) {
        @case ('light') {
          <svg data-p-icon="sun" aria-hidden="true"></svg>
        }
        @case ('dark') {
          <svg data-p-icon="moon" aria-hidden="true"></svg>
        }
        @default {
          <svg data-p-icon="desktop" aria-hidden="true"></svg>
        }
      }
    </discocan-menu-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeMenu {
  protected readonly appearance = inject(Appearance);
  private readonly language = inject(UI_LANGUAGE);
  private readonly text = computed(() => uiMessages[this.language()].theme);
  protected readonly label = computed(
    () => `${this.text().label}: ${this.text()[this.appearance.mode()]}`,
  );
  protected readonly options = computed<readonly MenuOption[]>(() =>
    themeModes.map((mode) => ({
      id: mode,
      label: this.text()[mode],
      selected: mode === this.appearance.mode(),
    })),
  );

  protected choose(id: string): void {
    const mode = themeModes.find((value) => value === id);
    if (mode) {
      this.appearance.setMode(mode);
    }
  }
}
