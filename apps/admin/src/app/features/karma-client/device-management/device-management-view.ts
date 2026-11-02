import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  decodeRuleRecord,
  encodeRuleData,
  encodeRuleRecord,
  parseRuleExpression,
} from '@holita/edata-rules';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  AdminRequestDeviceConfigurationReadMutationVariables,
  AdminRequestDeviceRulesReadMutationVariables,
  AdminRequestDeviceRuleChangeMutationVariables,
  AdminRequestDeviceParameterAdditionMutationVariables,
  AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { EmptyState } from '../../../ui/empty-state/empty-state';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe, FormatNumberPipe } from '../../../ui/format/format.pipes';
import { formatNumber } from '../../../ui/format/format';
import type { ListActionBase, ListActionRequest, ListRecord } from '../../../ui/list/list-actions';
import { RowActions } from '../../../ui/row-actions/row-actions';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import {
  DeviceParameterEditor,
  type DeviceParameterPreset,
} from '../../fleet/device-operations/device-parameter-editor';
import { DeviceRuleReview } from '../../fleet/device-operations/device-rule-review';
import {
  deviceReadPending,
  type DeviceConfigurationTarget,
  type DeviceConfigurationOperation,
  type DeviceConfigurationState,
  type DeviceParameterMeasurements,
} from '../../fleet/device-operations/device-configuration-types';
import { deviceConfigurationText } from '../../fleet/device-operations/i18n/messages';
import { DeviceRuleEditor } from './device-rule-editor';
import {
  RuleDraftStore,
  draftRecord,
  exportRulesIni,
  importedRule,
  importRules,
  type RuleDraft,
} from './rule-drafts';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

interface ParameterSetting {
  readonly id: number;
  readonly name: string;
  readonly interval: number;
}
interface RuleRow extends RuleDraft {
  readonly previous: RuleDraft | undefined;
  readonly conflict: boolean;
}

/** One read, edit, review and verified-result flow for the selected truck. */
@Component({
  selector: 'holita-device-management-view',
  imports: [
    ButtonDirective,
    Message,
    TableModule,
    Tag,
    EmptyState,
    RouteDrawer,
    FormField,
    FormatDateTimePipe,
    FormatNumberPipe,
    RowActions,
    TablePanel,
    DeviceParameterEditor,
    DeviceRuleReview,
    DeviceRuleEditor,
  ],
  templateUrl: './device-management-view.html',
  styleUrl: './device-management-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class DeviceManagementView {
  readonly language = input.required<Language>();
  readonly car = input.required<DeviceConfigurationTarget>();
  readonly state = input<DeviceConfigurationState>('ready');
  readonly branchId = input<string | null>(null);
  readonly enabled = input(false);
  readonly writesEnabled = input(false);
  readonly presets = input<readonly DeviceParameterPreset[]>([]);
  readonly operations = input<readonly DeviceConfigurationOperation[]>([]);
  readonly lastSnapshot = input<DeviceConfigurationOperation | null>(null);
  readonly lastRulesSnapshot = input<DeviceConfigurationOperation | null>(null);
  readonly acceptedOperationId = input<string | null>(null);
  readonly writeError = input<string | null>(null);
  readonly writeFieldErrors = input<
    Partial<Record<'catalogId' | 'parameterId' | 'intervalSeconds', string>>
  >({});
  readonly requesting = input(false);
  readonly refreshing = input(false);
  readonly reconciling = input(false);
  readonly loadError = input<string | null>(null);
  readonly pollError = input<string | null>(null);
  readonly requestError = input<string | null>(null);
  readonly readSequence = input<'parameters' | 'rules' | null>(null);
  readonly measurements = input<DeviceParameterMeasurements | null>(null);
  readonly requestMeasurements = output<number>();
  readonly refreshMeasurements = output();
  readonly closeMeasurements = output();
  readonly requestConfiguration =
    output<AdminRequestDeviceConfigurationReadMutationVariables['input']>();
  readonly requestRead = output<AdminRequestDeviceConfigurationReadMutationVariables['input']>();
  readonly requestRulesRead = output<AdminRequestDeviceRulesReadMutationVariables['input']>();
  readonly requestRuleChange = output<AdminRequestDeviceRuleChangeMutationVariables['input']>();
  readonly requestAddition =
    output<AdminRequestDeviceParameterAdditionMutationVariables['input']>();
  readonly requestIntervalUpdate =
    output<AdminRequestDeviceParameterIntervalUpdateMutationVariables['input']>();
  readonly writeDraftChanged = output();
  readonly refresh = output();

  private readonly draftStore = inject(RuleDraftStore);
  private readonly parameterEditor = viewChild(DeviceParameterEditor);
  private readonly ruleEditor = viewChild(DeviceRuleEditor);
  private readonly ruleReview = viewChild(DeviceRuleReview);
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly operationText = computed(() => deviceConfigurationText(this.language()));
  protected readonly selectedRule = signal<RuleDraft | null>(null);
  protected readonly editingRule = signal<RuleDraft | null | undefined>(undefined);
  private submittedDraft: { draft: RuleDraft; definitionHex: string } | null = null;
  protected readonly operationPending = deviceReadPending;
  protected readonly pending = computed(() => this.operations().some(deviceReadPending));
  protected readonly busy = computed(
    () => this.pending() || this.requesting() || this.refreshing() || this.reconciling(),
  );
  protected readonly readUnavailable = computed(
    () => !this.branchId() || !this.enabled() || this.state() !== 'ready' || this.busy(),
  );
  protected readonly matchingSnapshot = computed(() => {
    const snapshot = this.lastSnapshot();
    return snapshot && this.matchesTarget(snapshot) ? snapshot : null;
  });
  protected readonly rulesSnapshot = computed(() => {
    const snapshot = this.lastRulesSnapshot();
    return snapshot && this.matchesTarget(snapshot) ? snapshot : null;
  });
  protected readonly rulesContinuation = computed(() => {
    const parameters = this.matchingSnapshot();
    const rules = this.rulesSnapshot();
    return (
      parameters?.kind === 'READ_CONFIGURATION' &&
      parameters.status === 'COMPLETE' &&
      (!rules || rules.requestedAt < parameters.requestedAt)
    );
  });
  protected readonly visibleOperations = computed(() =>
    this.operations()
      .filter((operation) => this.matchesTarget(operation))
      .toSorted((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
  );
  protected readonly latestOperation = computed(() => this.visibleOperations()[0] ?? null);
  protected readonly snapshotOperation = this.matchingSnapshot;
  protected readonly lastReadAt = computed(
    () =>
      [this.matchingSnapshot(), this.rulesSnapshot()]
        .filter((operation) => operation?.status === 'COMPLETE')
        .map((operation) => operation?.completedAt ?? '')
        .sort()
        .at(-1) || null,
  );
  protected readonly attentionOperations = computed(() =>
    this.visibleOperations().filter(
      (operation) =>
        deviceReadPending(operation) ||
        operation.status === 'FAILED' ||
        operation.status === 'TIMED_OUT',
    ),
  );
  protected readonly readiness = computed(() => {
    const text = this.text();
    if (this.state() === 'loading') {
      return text.loadingSettings;
    }
    if (this.state() !== 'ready') {
      return text.settingsUnavailable;
    }
    if (!this.branchId()) {
      return text.chooseBranch;
    }
    if (!this.enabled()) {
      return text.dispatchOff;
    }
    if (this.busy()) {
      return text.waitForResult;
    }
    if (!this.writesEnabled()) {
      return text.writesOff;
    }
    if (!this.matchingSnapshot()?.configuration) {
      return text.readBeforeEditing;
    }
    if (!this.rulesSnapshot()?.rulesConfiguration) {
      return text.parametersReady;
    }
    return text.readyToChange;
  });
  protected readonly intervalEditingUnavailable = computed(
    () =>
      !this.writesEnabled() ||
      this.readUnavailable() ||
      !this.matchingSnapshot()?.configuration ||
      this.matchingSnapshot()?.status !== 'COMPLETE',
  );
  protected readonly ruleSendingUnavailable = computed(
    () =>
      this.intervalEditingUnavailable() ||
      !this.rulesSnapshot()?.rulesConfiguration ||
      this.rulesSnapshot()?.status !== 'COMPLETE',
  );
  protected readonly parameters = computed<ParameterSetting[]>(() =>
    (this.snapshotOperation()?.configuration?.parameters ?? []).map((row) => ({
      id: row.parameterId,
      name:
        this.presets().find((preset) => preset.parameterId === row.parameterId)?.name ??
        `${this.text().parameter} ${String(row.parameterId)}`,
      interval: row.intervalSeconds,
    })),
  );
  protected readonly measurementParameter = computed(() =>
    this.parameters().find((row) => row.id === this.measurements()?.parameterId),
  );
  protected readonly measurementChange = computed(() =>
    this.visibleOperations().find(
      (operation) =>
        operation.parameterId === this.measurements()?.parameterId &&
        (operation.kind === 'ADD_PARAMETER' || operation.kind === 'UPDATE_INTERVAL') &&
        operation.status === 'COMPLETE' &&
        operation.completedAt !== null,
    ),
  );
  protected readonly measurementReadings = computed(() => {
    const measurement = this.measurements();
    const seen = new Set<string>();
    return (measurement?.items ?? [])
      .flatMap((message) => {
        const parameter = message.parameters.find(
          (row) => row.id === String(measurement?.parameterId),
        );
        if (!parameter || seen.has(message.id)) {
          return [];
        }
        seen.add(message.id);
        const utc = message.eventTimeUtc ? message.eventTimeUtc.replace(' ', 'T') + 'Z' : null;
        const time = utc ? Date.parse(utc) : Number.NaN;
        return [
          {
            id: message.id,
            value: parameter.value,
            description: parameter.description,
            utc: Number.isFinite(time) ? utc : null,
            time: Number.isFinite(time) ? time : null,
          },
        ];
      })
      .sort(
        (left, right) =>
          (right.time ?? Number.NEGATIVE_INFINITY) - (left.time ?? Number.NEGATIVE_INFINITY),
      );
  });
  protected readonly latestMeasurement = computed(() => this.measurementReadings()[0] ?? null);
  protected readonly recentMeasurements = computed(() => {
    const changeAt = this.measurementChange()?.completedAt;
    const changeTime = changeAt ? Date.parse(changeAt) : null;
    const readings = this.measurementReadings()
      .slice(0, 4)
      .sort(
        (left, right) =>
          (left.time ?? Number.POSITIVE_INFINITY) - (right.time ?? Number.POSITIVE_INFINITY),
      );
    return readings.map((row, index) => {
      const previous = readings[index - 1];
      return {
        ...row,
        deltaSeconds:
          row.time !== null && previous?.time !== null && previous?.time !== undefined
            ? (row.time - previous.time) / 1000
            : null,
        afterChange: row.time !== null && changeTime !== null ? row.time > changeTime : null,
      };
    });
  });
  protected readonly hasPostChangeValues = computed(() => {
    const completedAt = this.measurementChange()?.completedAt;
    return (
      !!completedAt &&
      this.measurementReadings().some(
        (row) => row.value !== null && row.time !== null && row.time > Date.parse(completedAt),
      )
    );
  });
  protected readonly ruleParameters = computed(() => {
    const configured = (this.matchingSnapshot()?.configuration?.parameters ?? []).map((row) => ({
      id: row.parameterId,
      name:
        this.presets().find((preset) => preset.parameterId === row.parameterId)?.name ??
        `${this.text().parameter} ${String(row.parameterId)}`,
    }));
    return configured.length ? configured : (this.draftStore.source()?.parameters ?? []);
  });
  protected readonly confirmedRules = computed<RuleDraft[]>(() =>
    (this.rulesSnapshot()?.rulesConfiguration?.rules ?? []).map((rule) => ({
      ...importedRule(decodeRuleRecord(rule.definitionHex), this.ruleName(rule.ruleId)),
      id: `device:${String(rule.ruleId)}`,
      confirmed: true,
    })),
  );
  protected readonly displayedRules = computed<RuleRow[]>(() => {
    const drafts = this.draftStore.rules();
    const confirmed = this.confirmedRules();
    return [
      ...drafts.map((draft) => ({
        ...draft,
        previous: confirmed.find((row) => row.ruleId === draft.ruleId),
        conflict:
          draft.ruleId !== undefined &&
          drafts.filter((row) => row.ruleId === draft.ruleId).length > 1,
      })),
      ...confirmed
        .filter((row) => !drafts.some((draft) => draft.ruleId === row.ruleId))
        .map((row) => ({ ...row, previous: undefined, conflict: false })),
    ];
  });
  protected readonly newRuleId = computed(() => {
    const used = this.displayedRules().map((row) => row.ruleId);
    let id = 0;
    while (used.includes(id)) {
      id++;
    }
    return id;
  });
  protected readonly occupiedRuleIds = computed(() =>
    this.confirmedRules().flatMap((row) => (row.ruleId === undefined ? [] : [row.ruleId])),
  );
  protected readonly selectedRuleDuplicate = computed(() => {
    const selected = this.selectedRule();
    return (
      selected?.ruleId !== undefined &&
      this.draftStore.rules().filter((row) => row.ruleId === selected.ruleId).length > 1
    );
  });
  protected readonly previousRuleExpression = computed(() => {
    const previous = this.confirmedRules().find(
      (rule) => rule.ruleId === this.selectedRule()?.ruleId,
    );
    return previous ? this.displayExpression(previous.expression) : null;
  });
  protected readonly catalogVersion = computed(
    () => [...new Set(this.presets().map((row) => row.catalogId))].join(', ') || null,
  );
  protected readonly parameterView = computed<TableView>(() => ({
    kind:
      this.state() === 'loading' && !this.snapshotOperation()
        ? 'loading'
        : this.parameters().length
          ? 'rows'
          : 'empty',
  }));
  protected readonly ruleView = computed<TableView>(() => ({
    kind:
      this.state() === 'loading' && !this.displayedRules().length
        ? 'loading'
        : this.displayedRules().length
          ? 'rows'
          : 'empty',
  }));
  protected readonly ruleActions = computed<readonly ListActionBase<string>[]>(() => [
    { id: 'edit', label: this.text().edit },
    { id: 'send', label: this.text().reviewSend },
    {
      id: 'remove',
      label: this.text().remove,
      danger: true,
      confirm: {
        title: this.text().removeQuestion,
        accept: this.text().remove,
        detail: this.text().localRemoval,
      },
    },
  ]);
  protected readonly parameterActions = computed<readonly ListActionBase<string>[]>(() => [
    { id: 'edit', label: this.text().changeInterval },
    { id: 'measurements', label: this.text().measurements },
  ]);
  protected readonly importError = signal(false);
  protected readonly exportError = signal(false);
  protected readonly storageError = this.draftStore.storageError;
  protected readonly importSource = this.draftStore.source;
  protected readonly importArchives = this.draftStore.archives;

  constructor() {
    effect(() => {
      const acceptedId = this.acceptedOperationId();
      if (acceptedId) {
        untracked(() => {
          const operation = this.operations().find((row) => row.id === acceptedId);
          const submitted = this.submittedDraft;
          if (operation?.kind === 'UPSERT_RULE' && submitted) {
            this.draftStore.recordSubmission(submitted.draft, operation, submitted.definitionHex);
          }
          this.submittedDraft = null;
          this.selectedRule.set(null);
        });
      }
    });
    effect(() => {
      const snapshot = this.rulesSnapshot();
      if (snapshot) {
        this.draftStore.reconcile(snapshot);
      }
    });
  }

  private ruleName(ruleId: number): string {
    const snapshot = this.rulesSnapshot();
    return (
      (snapshot ? this.draftStore.confirmedName(snapshot, ruleId) : undefined) ??
      `${this.text().rule} ${String(ruleId)}`
    );
  }

  protected submitRule(input: AdminRequestDeviceRuleChangeMutationVariables['input']): void {
    const draft = this.selectedRule();
    if (!draft) {
      return;
    }
    const previous = this.rulesSnapshot()?.rulesConfiguration?.rules.find(
      (row) => row.ruleId === draft.ruleId,
    );
    this.submittedDraft = {
      draft: this.draftStore.rules().find((row) => row.id === draft.id) ?? draft,
      definitionHex: encodeRuleRecord({
        ...draftRecord(draft),
        activateDashboard: previous?.activateDashboard ?? false,
        ruleDataHex: encodeRuleData(parseRuleExpression(input.expression)),
      }),
    };
    this.requestRuleChange.emit(input);
  }

  private matchesTarget(operation: DeviceConfigurationOperation): boolean {
    return (
      operation.branchId === this.branchId() &&
      operation.karmaCarId === this.car().id &&
      operation.karmaDeviceId === this.car().deviceId
    );
  }

  protected parameterRecord(row: ParameterSetting): ListRecord<string> {
    return {
      id: String(row.id),
      label: row.name,
      unavailable: this.intervalEditingUnavailable() ? ['edit'] : [],
    };
  }

  protected parameterAction(event: ListActionRequest<string>): void {
    const id = event.ids[0];
    if (event.action === 'measurements') {
      const parameter = this.parameters().find((row) => String(row.id) === id);
      if (parameter) {
        this.requestMeasurements.emit(parameter.id);
      }
    } else {
      void this.editParameter(id);
    }
  }

  protected measurementValue(value: number | null): string {
    return formatNumber(value, this.language(), { significantDigits: 21 });
  }

  protected ruleRecord(row: RuleRow): ListRecord<string> {
    return {
      id: row.id,
      label: row.name,
      unavailable: [
        ...(row.opaque ? ['edit', 'send'] : []),
        ...(this.ruleSendingUnavailable() ? ['edit', 'send'] : []),
        ...(row.conflict ? ['send'] : []),
        ...(row.confirmed ? ['remove'] : []),
      ],
    };
  }

  protected displayExpression(value: string): string {
    return value
      .replace(
        /\[(\d+)\]/g,
        (_match: string, id: string) =>
          this.ruleParameters().find((row) => row.id === Number(id))?.name ??
          `${this.text().parameter} ${id}`,
      )
      .replace(/>=|<=|!=|=|>|</g, (operator) => {
        const labels: Record<string, string> = {
          '>': this.text().greaterThan,
          '<': this.text().lessThan,
          '>=': this.text().atLeast,
          '<=': this.text().atMost,
          '=': this.text().equalTo,
          '!=': this.text().notEqualTo,
        };
        return labels[operator] ?? operator;
      })
      .replace(/\band\b/g, this.text().and)
      .replace(/\bor\b/g, this.text().or);
  }

  protected ruleSentence(row: RuleDraft): string {
    if (row.opaque) {
      return this.text().opaqueHint;
    }
    const text = this.text();
    const send = row.trueEvent ? `${text.sendEvent} ${String(row.trueEvent)}` : text.noReport;
    const clear = row.falseEvent
      ? `${text.onClear} ${text.sendEvent} ${String(row.falseEvent)}`
      : text.onClearNoReport;
    return `${text.when} ${this.displayExpression(row.expression)} ${text.forDuration} ${formatNumber(row.debounce / 1000, this.language(), { fraction: 3 })} ${text.seconds}, ${send}; ${clear}.`;
  }

  protected openRule(row: RuleDraft | null = null): void {
    if (this.ruleSendingUnavailable()) {
      return;
    }
    this.editingRule.set(row);
  }

  protected saveRule({ draft, review }: { draft: RuleDraft; review: boolean }): void {
    this.draftStore.save(draft);
    this.editingRule.set(undefined);
    if (review) {
      this.reviewRule(draft);
    }
  }

  protected ruleAction(event: ListActionRequest<string>): void {
    const rule = this.displayedRules().find((row) => row.id === event.ids[0]);
    if (!rule) {
      return;
    }
    if (event.action === 'remove' && !rule.confirmed) {
      this.draftStore.remove(rule.id);
    } else if (event.action === 'send') {
      this.reviewRule(rule);
    } else if (event.action === 'edit' && !rule.opaque) {
      this.openRule(rule);
    }
  }

  protected reviewRule(draft: RuleDraft): void {
    if (!draft.opaque && !this.ruleSendingUnavailable()) {
      this.selectedRule.set(draft);
      this.writeDraftChanged.emit();
    }
  }

  protected editParameter(id?: string): Promise<void> | undefined {
    this.submittedDraft = null;
    if (this.intervalEditingUnavailable()) {
      return;
    }
    return id === undefined
      ? this.parameterEditor()?.openAddition()
      : this.parameterEditor()?.editInterval(Number(id));
  }

  protected submitRead(section: 'all' | 'parameters' | 'rules' = 'all'): void {
    if (this.readUnavailable()) {
      return;
    }
    const request = {
      karmaCarId: this.car().id,
      expectedKarmaDeviceId: this.car().deviceId,
    };
    if (section === 'all') {
      this.requestConfiguration.emit(request);
    } else if (section === 'rules') {
      this.requestRulesRead.emit(request);
    } else {
      this.requestRead.emit(request);
    }
  }

  async canLeave(): Promise<boolean> {
    return (
      !this.requesting() &&
      (await (this.parameterEditor()?.canLeave() ?? true)) &&
      (await (this.ruleEditor()?.canLeave() ?? true)) &&
      (await (this.ruleReview()?.canLeave() ?? true))
    );
  }

  protected statusSeverity(status: DeviceConfigurationOperation['status']) {
    switch (status) {
      case 'COMPLETE':
        return 'success';
      case 'FAILED':
        return 'danger';
      case 'TIMED_OUT':
      case 'UNKNOWN':
        return 'warn';
      default:
        return 'info';
    }
  }

  protected sentAt(operation: DeviceConfigurationOperation): string | null {
    return operation.kind === 'ADD_PARAMETER' ||
      operation.kind === 'UPDATE_INTERVAL' ||
      operation.kind === 'UPSERT_RULE'
      ? operation.writeDispatchedAt
      : operation.dispatchedAt;
  }

  protected operationFailure(operation: DeviceConfigurationOperation): string {
    return operation.errorCode === 'READ_NO_CONFIGURATION'
      ? this.operationText().errors.noConfiguration
      : this.operationText().errors.generic;
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
      return;
    }
    this.importError.set(false);
    try {
      this.draftStore.import(importRules(input.files[0].name, await input.files[0].text()));
    } catch {
      this.importError.set(true);
    }
    input.value = '';
  }

  protected downloadOriginal(source: { filename: string; original: string }): void {
    const url = URL.createObjectURL(
      new Blob([source.original], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = source.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected exportFile(kind: 'ini' | 'txt' | 'original'): void {
    this.exportError.set(false);
    try {
      const source = this.importSource();
      const content =
        kind === 'original'
          ? (source?.original ?? '')
          : kind === 'ini'
            ? exportRulesIni(this.draftStore.rules(), source)
            : [
                '# holita inspection only. Each 04 record changes one rule. This file is never executed.',
                ...this.draftStore
                  .rules()
                  .map((rule) => `04${encodeRuleRecord(draftRecord(rule))}`),
              ].join('\n');
      this.downloadOriginal({
        filename: kind === 'original' ? (source?.filename ?? 'source.txt') : `holita-rules.${kind}`,
        original: content,
      });
    } catch {
      this.exportError.set(true);
    }
  }
}
