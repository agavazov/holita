import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import {
  GroupDrawer,
  type GroupField,
  type GroupForm,
} from '../../../app/features/fleet/settings/group-drawer';
import {
  type GroupActionId,
  type GroupRow,
  GroupsView,
} from '../../../app/features/fleet/settings/groups-view';
import { settingsText } from '../../../app/features/fleet/settings/i18n/messages';
import { interpolate } from '../../../app/ui/i18n/messages';
import type { ListActionRequest } from '../../../app/ui/list/list-actions';
import type { TableNotice } from '../../../app/ui/table-panel/table-panel';
import { tableView } from '../../../app/ui/table-panel/table-view';
import { UI_LANGUAGE } from '../../../app/ui/ui-language';
import { type SampleGroup, sampleGroups, sampleVehicles } from '../fleet-samples';
import { injectClearDrawer, injectQueryParams, saveDelayMs, scenarioOf } from '../scenario';

/**
 * Story-only host of the Vehicle groups example: a short settings list over the sample groups,
 * a simulated save and `?scenario=` / `?drawer=<id|new>` for the stories' states.
 */
@Component({
  selector: 'holita-example-groups-page',
  imports: [GroupsView, GroupDrawer],
  template: `
    <holita-groups-view
      [rows]="rows()"
      [view]="view()"
      [notice]="notice()"
      (create)="openEditor(null)"
      (action)="run($event)"
      (retry)="failed.set(false)"
      (dismissNotice)="notice.set(null)"
    />
    @if (editor(); as open) {
      <holita-group-drawer
        [group]="open.form"
        [saving]="saving()"
        [fieldErrors]="fieldErrors()"
        (save)="save($event)"
        (closed)="closeEditor()"
      />
    }
  `,
})
export class GroupsPage {
  private readonly language = inject(UI_LANGUAGE);
  private readonly query = injectQueryParams();
  private readonly clearDrawer = injectClearDrawer();
  private readonly scenario = computed(() =>
    scenarioOf(this.query(), ['loading', 'empty', 'error']),
  );
  private readonly text = computed(() => settingsText(this.language()).groups);
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;

  protected readonly groups = linkedSignal<readonly SampleGroup[]>(() =>
    this.scenario() === 'empty' ? [] : sampleGroups,
  );
  protected readonly failed = linkedSignal(() => this.scenario() === 'error');
  protected readonly notice = signal<TableNotice | null>(null);
  protected readonly editor = linkedSignal<{ id: string | null; form: GroupForm | null } | null>(
    () => {
      const drawer = this.query().get('drawer');
      if (drawer === 'new') return { id: null, form: null };
      const group = drawer ? sampleGroups.find((item) => item.id === drawer) : undefined;
      return group ? { id: group.id, form: group } : null;
    },
  );
  protected readonly saving = signal(false);
  protected readonly fieldErrors = signal<Partial<Record<GroupField, string>>>({});
  protected readonly rows = computed<readonly GroupRow[]>(() =>
    this.groups().map((group) => ({
      ...group,
      vehicles: sampleVehicles.filter((vehicle) => vehicle.groupId === group.id).length,
    })),
  );
  protected readonly view = computed(() =>
    tableView({
      loading: this.scenario() === 'loading',
      error: this.failed() ? 'failed' : null,
      rows: this.scenario() === 'loading' || this.failed() ? null : this.rows().length,
      filtered: false,
    }),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.saveTimer);
    });
  }

  protected openEditor(id: string | null): void {
    const group = id ? this.groups().find((item) => item.id === id) : undefined;
    this.fieldErrors.set({});
    this.editor.set({ id: group?.id ?? null, form: group ?? null });
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.clearDrawer();
  }

  /** Row actions: the view already confirmed them and left out groups they do not apply to. */
  protected run({ action, ids }: ListActionRequest<GroupActionId>): void {
    const [id] = ids;
    switch (action) {
      case 'edit':
        if (id) this.openEditor(id);
        return;
      case 'delete':
        this.delete(ids);
        return;
    }
  }

  protected save(form: GroupForm): void {
    const editor = this.editor();
    if (!editor || this.saving()) return;
    this.saving.set(true);
    this.fieldErrors.set({});
    this.saveTimer = setTimeout(() => {
      this.saving.set(false);
      const name = form.name.toLocaleLowerCase('en');
      if (
        this.groups().some(
          (item) => item.id !== editor.id && item.name.toLocaleLowerCase('en') === name,
        )
      ) {
        this.fieldErrors.set({ name: this.text().drawer.duplicateName });
        return;
      }
      const id = editor.id ?? `example-group-${String(this.nextId++)}`;
      const group: SampleGroup = { id, ...form };
      this.groups.update((groups) =>
        editor.id ? groups.map((item) => (item.id === id ? group : item)) : [...groups, group],
      );
      this.closeEditor();
      const template = editor.id ? this.text().saved : this.text().created;
      this.notice.set({ severity: 'success', text: interpolate(template, { name: form.name }) });
    }, saveDelayMs);
  }

  private delete(ids: readonly string[]): void {
    this.groups.update((groups) => groups.filter((item) => !ids.includes(item.id)));
    this.notice.set({
      severity: 'success',
      text: interpolate(this.text().deleted, { count: ids.length }),
    });
  }
}
