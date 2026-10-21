import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import type { AdminBranchesQuery } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { BranchContext } from '../../branches/branch-context';
import { FleetPreferences } from './fleet-preferences';
import { GeneralSettingsApi } from './general-settings-api';
import {
  generalSettingsFieldErrors,
  generalSettingsForm,
  generalSettingsInput,
} from './general-settings-mapping';
import { GeneralSettingsView, type GeneralSettings } from './general-settings-view';
import { settingsText } from './i18n/messages';

@Component({
  selector: 'holita-general-settings-page',
  imports: [GeneralSettingsView],
  providers: [GeneralSettingsApi],
  template: `
    <holita-general-settings-view
      [branchName]="settings()?.name ?? branch().name"
      [settings]="settings()"
      [state]="settings() ? 'ready' : 'loading'"
      [saving]="saving()"
      [retainDraft]="retainDraft()"
      [saveError]="failure()"
      [fieldErrors]="fieldErrors()"
      [notificationsUnavailable]="true"
      (save)="save($event)"
      (discarded)="discard()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralSettingsPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(GeneralSettingsApi);
  private readonly preferences = inject(FleetPreferences);
  private readonly branches = inject(BranchContext);
  private readonly notices = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly view = viewChild(GeneralSettingsView);
  private readonly text = computed(() => settingsText(this.language()).general);
  readonly settings = signal<GeneralSettings | null>(null);
  readonly saving = signal(false);
  readonly retainDraft = signal(false);
  readonly saveError = signal<unknown>(null);
  readonly partialSave = signal(false);
  protected readonly fieldErrors = computed(() =>
    generalSettingsFieldErrors(this.saveError(), this.language()),
  );
  protected readonly failure = computed(() => {
    const error = this.saveError();
    if (!error) {
      return null;
    }
    const detail = requestError(error, this.text().saveError);
    return this.partialSave() ? `${this.text().partialSaveError} ${detail}` : detail;
  });

  constructor() {
    effect(() => {
      const preferences = this.preferences.settings();
      if (preferences && !this.settings()) {
        this.settings.set(generalSettingsForm(preferences, this.branch().name));
      }
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.branch().id, this.language());
  }

  /** Fleet preferences and the Core name are separate writes, never an atomic save. */
  async save(form: GeneralSettings): Promise<void> {
    const canonical = this.settings();
    if (!canonical || this.saving()) {
      return;
    }
    const branchId = this.branch().id;
    const name = form.name.trim();
    this.saving.set(true);
    this.retainDraft.set(true);
    this.saveError.set(null);
    this.partialSave.set(false);
    let fleetSaved = false;
    try {
      const saved = await this.api.update({ input: generalSettingsInput(form) });
      if (!this.current()) {
        return;
      }
      fleetSaved = true;
      this.preferences.apply(saved);
      this.settings.set(generalSettingsForm(saved, canonical.name));
      if (name !== canonical.name) {
        const branch = await this.api.renameBranch({ id: branchId, name });
        if (!this.current()) {
          return;
        }
        this.settings.set(generalSettingsForm(saved, branch.name));
        this.branches.refresh();
      }
      this.retainDraft.set(false);
      this.notices.add({ severity: 'success', summary: this.text().saved, life: 5000 });
    } catch (error: unknown) {
      if (this.current()) {
        this.saveError.set(error);
        this.partialSave.set(fleetSaved);
        if (fleetSaved) {
          this.notices.add({
            severity: 'warn',
            summary: this.text().partialSaveError,
            detail: requestError(error, this.text().saveError),
            sticky: true,
          });
        }
      }
    } finally {
      if (this.current()) {
        this.saving.set(false);
      }
    }
  }

  discard(): void {
    this.saveError.set(null);
    this.partialSave.set(false);
    this.retainDraft.set(false);
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && (this.view()?.canLeave() ?? true);
  }

  private current(): boolean {
    return !this.destroyRef.destroyed;
  }
}
