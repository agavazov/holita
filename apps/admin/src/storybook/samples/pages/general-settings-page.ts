import {
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import {
  type GeneralSettings,
  GeneralSettingsView,
} from '../../../app/features/fleet/settings/general-settings-view';
import { settingsText } from '../../../app/features/fleet/settings/i18n/messages';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import { injectBranchName, injectQueryParams, saveDelayMs, scenarioOf } from '../scenario';

const initialSettings: Omit<GeneralSettings, 'name'> = {
  timeZone: 'Europe/Sofia',
  distanceUnit: 'km',
  volumeUnit: 'l',
  lowFuelPct: 12,
  notReportingHours: 48,
  speedLimitKph: 90,
  criticalAlerts: true,
  dailySummary: false,
  documentReminders: true,
};

/** Story-only host of the General settings example: one settings record and a simulated save. */
@Component({
  selector: 'holita-example-general-settings-page',
  imports: [GeneralSettingsView],
  template: `
    <holita-general-settings-view
      [demo]="true"
      [branchName]="branchName()"
      [settings]="settings()"
      [saving]="saving()"
      [saveError]="saveError()"
      (save)="save($event)"
      (discarded)="saveError.set(null)"
    />
  `,
})
export class GeneralSettingsPage {
  private readonly view = viewChild.required(GeneralSettingsView);
  private readonly language = inject(UI_LANGUAGE);
  private readonly messages = inject(MessageService);
  private readonly query = injectQueryParams();
  private readonly scenario = computed(() => scenarioOf(this.query(), ['save-error']));
  private readonly text = computed(() => settingsText(this.language()).general);
  private readonly failNextSave = linkedSignal(() => this.scenario() === 'save-error');
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly branchName = injectBranchName();
  protected readonly settings = linkedSignal<GeneralSettings>(() => ({
    name: this.branchName(),
    ...initialSettings,
  }));
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return this.view().canLeave();
  }

  protected save(settings: GeneralSettings): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      if (this.failNextSave()) {
        this.failNextSave.set(false);
        this.saveError.set(this.text().saveError);
        return;
      }
      this.settings.set(settings);
      this.messages.add({ severity: 'success', summary: this.text().saved });
    }, saveDelayMs);
  }
}
