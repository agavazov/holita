import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';
import { ModuleInfo } from './module-info';

/** One dialog host in the shell for both module-information entry points. */
@Component({
  selector: 'discocan-module-info-dialog',
  imports: [Dialog],
  template: `
    <p-dialog
      id="module-info-dialog"
      [visible]="moduleInfo.visible()"
      (visibleChange)="moduleInfo.visible.set($event)"
      [header]="moduleInfo.info()?.title ?? ''"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closeAriaLabel]="closeLabel()"
      [style]="{ width: 'min(32rem, calc(100vw - 2rem))' }"
    >
      <p>{{ moduleInfo.info()?.body }}</p>
    </p-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleInfoDialog {
  protected readonly moduleInfo = inject(ModuleInfo);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly closeLabel = computed(() => uiMessages[this.language()].close);
}
