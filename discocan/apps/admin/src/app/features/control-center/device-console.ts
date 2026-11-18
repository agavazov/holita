import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AutoComplete, type AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type {
  AdminControlCenterActionCommandsQuery,
  AdminControlCenterCommandRequestQuery,
  AdminControlCenterConfigurationChangesQuery,
  AdminControlCenterEdataParametersQuery,
  AdminControlCenterEdataProfilesQuery,
  AdminControlCenterParameterBaselineQuery,
  AdminControlCenterParameterCatalogQuery,
  ErmDeviceAction,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import type { Language } from '../../i18n/messages';
import { FormField } from '../../ui/form-field/form-field';
import { FormatDateTimePipe } from '../../ui/format/format.pipes';
import { interpolate } from '../../ui/i18n/messages';
import { toneSeverity } from '../../ui/tones';
import { ControlCenterApi } from './control-center-api';
import { controlCenterError, controlCenterReason, controlCenterText } from './control-center-text';

type ConsoleKind =
  | 'READ_ACTION'
  | 'READ_PARAMETERS'
  | 'READ_EDATA'
  | 'SNAPSHOT'
  | 'PARAMETER'
  | 'EDATA_INTERVAL'
  | 'GLOBALS';
// Queued reads wait for the unit's next primary connection instead of requiring it now.
const queuedKinds: ReadonlySet<ConsoleKind> = new Set(['READ_ACTION', 'READ_PARAMETERS']);
type CatalogEntry = AdminControlCenterParameterCatalogQuery['ermParameterCatalog']['items'][number];
type EdataEntry = AdminControlCenterEdataParametersQuery['fleetEdataParameters']['items'][number];
type Profile = AdminControlCenterEdataProfilesQuery['fleetEdataProfiles'][number];
type ActionCommand = AdminControlCenterActionCommandsQuery['ermDeviceActionCommands'][number];
type Run =
  AdminControlCenterConfigurationChangesQuery['fleetDevice']['ermConfigurationChanges'][number];
type Request = NonNullable<AdminControlCenterCommandRequestQuery['ermCommandRequest']>;
type Snapshot =
  AdminControlCenterParameterBaselineQuery['fleetDevice']['ermParameterSnapshots']['items'][number];
interface Definition {
  parameter: number;
  interval: number;
  definition: string;
}
interface Step {
  label: string;
  raw: string;
  write: boolean;
}

const writeKinds: ReadonlySet<ConsoleKind> = new Set(['PARAMETER', 'EDATA_INTERVAL', 'GLOBALS']);
const finalRequest = new Set(['ANSWERED', 'FAILED', 'EXPIRED', 'CANCELLED', 'UNCERTAIN']);
// Monitor guide: a Simple eData unit stores at most 100 parameters.
const edataCapacity = 100;

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, '0');
}

function edataFields(command: string, payload: string): string[] {
  return ['19', '0', '19', command, '0', '1', '1', payload];
}

/** Simple eData 4.04 section 3.1 with the Monitor 9.56 generic predefined-parameter defaults. */
function predefinedDefinition(parameterId: number, interval: number): string {
  return `${hex4(parameterId)}000000000000000100010000000000000000${hex4(interval)}`;
}

function definitions(baseline: unknown): Definition[] | null {
  if (typeof baseline !== 'object' || baseline === null || !('definitions' in baseline)) {
    return null;
  }
  const entries: unknown = baseline.definitions;
  if (!Array.isArray(entries)) {
    return null;
  }
  return entries.flatMap((entry: unknown) =>
    typeof entry === 'object' &&
    entry !== null &&
    'parameter' in entry &&
    typeof entry.parameter === 'number' &&
    'interval' in entry &&
    typeof entry.interval === 'number' &&
    'definition' in entry &&
    typeof entry.definition === 'string'
      ? [{ parameter: entry.parameter, interval: entry.interval, definition: entry.definition }]
      : [],
  );
}

function stepPayload(steps: unknown, name: string): string | null {
  if (!Array.isArray(steps)) {
    return null;
  }
  const entries: unknown[] = steps;
  for (const step of entries) {
    if (
      typeof step === 'object' &&
      step !== null &&
      'name' in step &&
      step.name === name &&
      'payload' in step &&
      typeof step.payload === 'string'
    ) {
      return step.payload;
    }
  }
  return null;
}

/** Catalog-driven command entry over the existing guarded workflows and allowlisted reads. */
@Component({
  selector: 'discocan-device-console',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AutoComplete,
    ButtonDirective,
    Checkbox,
    Dialog,
    InputText,
    Message,
    Select,
    TableModule,
    Tag,
    FormField,
    FormatDateTimePipe,
  ],
  templateUrl: './device-console.html',
  styles: `
    pre {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .console__write {
      font-weight: 600;
    }
    .console__steps {
      display: grid;
      gap: var(--p-app-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
  host: { class: 'app-tab-content' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceConsole {
  readonly deviceId = input.required<string>();
  readonly branchId = input.required<string>();
  readonly imei = input.required<string>();
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly primary = input(false);
  protected readonly text = computed(() => controlCenterText[this.language()].console);
  protected readonly common = computed(() => controlCenterText[this.language()]);
  private readonly api = inject(ControlCenterApi);
  private readonly session = inject(DemoSession);
  protected readonly canRead = computed(() => this.session.hasRole('OPERATOR'));
  protected readonly canWrite = computed(() => this.session.hasRole('ENGINEER'));

  protected readonly form = new FormGroup({
    kind: new FormControl<ConsoleKind>('READ_EDATA', { nonNullable: true }),
    action: new FormControl<ErmDeviceAction>('READ_STATUS', { nonNullable: true }),
    feature: new FormControl<string | null>(null),
    parameter: new FormControl<CatalogEntry | null>(null),
    readParameters: new FormControl<CatalogEntry[]>([], { nonNullable: true }),
    value: new FormControl('', { nonNullable: true }),
    category: new FormControl<number | null>(null),
    profile: new FormControl<number | null>(null),
    edataParameter: new FormControl<EdataEntry | null>(null),
    interval: new FormControl<number | null>(null),
    globalsHex: new FormControl('', { nonNullable: true }),
    restoreAfter: new FormControl(false, { nonNullable: true }),
  });
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly kind = computed(() => this.formValue().kind ?? 'READ_EDATA');
  protected readonly kinds = computed(() => {
    const labels = this.text().kinds;
    const kinds: readonly ConsoleKind[] = [
      'READ_PARAMETERS',
      'READ_EDATA',
      'READ_ACTION',
      'SNAPSHOT',
      'EDATA_INTERVAL',
      'PARAMETER',
      'GLOBALS',
    ];
    return kinds.map((value) => ({ value, label: labels[value] }));
  });

  protected readonly actionCommands = signal<readonly ActionCommand[]>([]);
  protected readonly actionOptions = computed(() =>
    this.actionCommands().map((entry) => ({
      value: entry.action,
      label: this.common().actions[entry.action],
    })),
  );

  protected readonly features = signal<string[]>([]);
  protected readonly parameterSuggestions = signal<CatalogEntry[]>([]);
  protected readonly parameterTotal = signal(0);
  protected readonly profiles = signal<readonly Profile[]>([]);
  protected readonly categories = computed(() => {
    const seen = new Map<number, string>();
    for (const profile of this.profiles()) {
      seen.set(profile.categoryId, profile.categoryName);
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  });
  protected readonly vehicleTypes = computed(() => {
    const category = this.formValue().category;
    return this.profiles()
      .filter((profile) => category === null || profile.categoryId === category)
      .map((profile) => ({
        value: profile.id,
        label: interpolate(this.text().profileOption, {
          name: profile.name,
          id: profile.id,
          count: profile.parameterCount,
        }),
      }));
  });
  protected readonly edataSuggestions = signal<EdataEntry[]>([]);
  protected readonly edataTotal = signal(0);
  protected readonly catalogLabel = signal<string | null>(null);
  private searchSequence = 0;

  protected readonly runs = signal<readonly Run[]>([]);
  protected readonly writesEnabled = signal(false);
  protected readonly snapshot = signal<Snapshot | null>(null);
  private readonly reload = signal(0);
  protected readonly running = computed(() =>
    this.runs().some(
      (run) => run.finishedAt === null && run.status !== 'FAILED' && run.status !== 'REFUSED',
    ),
  );
  protected readonly latestRead = computed(
    () =>
      this.runs().find((run) => run.operation === 'READ_EDATA' && run.status === 'READ') ?? null,
  );
  protected readonly configured = computed(() => {
    const read = this.latestRead();
    return read ? definitions(read.baseline) : null;
  });
  protected readonly readStale = computed(() => {
    const read = this.latestRead();
    return (
      read !== null &&
      this.runs().some(
        (run) =>
          run.operation !== 'READ_EDATA' &&
          run.operation !== 'PARAMETER' &&
          run.operation !== 'PARAMETERS' &&
          Date.parse(run.startedAt) > Date.parse(read.startedAt),
      )
    );
  });
  protected readonly unitProfile = computed(() => {
    const payload = stepPayload(this.latestRead()?.steps, 'profile');
    return payload && /^1F[0-9A-F]{4}$/i.test(payload)
      ? Number.parseInt(payload.slice(2), 16)
      : null;
  });
  protected readonly globals = computed(() => stepPayload(this.latestRead()?.steps, 'globals'));
  protected readonly globalsDump = computed(() => {
    const value = this.globals();
    if (!value) {
      return null;
    }
    const rows: string[] = [];
    for (let index = 0; index < value.length; index += 16) {
      const bytes = (value.slice(index, index + 16).match(/../g) ?? []).join(' ');
      rows.push(`${String(index / 2).padStart(2, '0')}  ${bytes}`);
    }
    return rows.join('\n');
  });
  protected readonly configuredNames = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly configuredRows = computed(() =>
    (this.configured() ?? []).map((entry) => ({
      ...entry,
      hex: hex4(entry.parameter),
      name: this.configuredNames().get(entry.parameter) ?? '—',
    })),
  );

  protected readonly selectedParameter = computed(() => this.formValue().parameter ?? null);
  protected readonly selectedEdata = computed(() => this.formValue().edataParameter ?? null);
  protected readonly currentValue = computed(() => {
    const parameter = this.selectedParameter();
    const value = parameter
      ? this.snapshot()?.values.find((entry) => entry.parameter === parameter.parameter)
      : undefined;
    return value?.outcome === 'READ' ? value.value : null;
  });
  protected readonly valueOptions = computed(() =>
    (this.selectedParameter()?.options ?? []).map((option) => ({
      value: option.value,
      label: `${option.value} · ${option.label}`,
    })),
  );
  protected readonly freeValue = computed(() =>
    (this.selectedParameter()?.options ?? []).some((option) => !/^-?\d+$/.test(option.value)),
  );
  protected readonly existingDefinition = computed(() => {
    const entry = this.selectedEdata();
    return entry
      ? (this.configured()?.find((definition) => definition.parameter === entry.parameterId) ??
          null)
      : null;
  });

  protected readonly steps = computed<readonly Step[]>(() => {
    const value = this.formValue();
    const labels = this.text().stepLabels;
    const frame = (command: string, fields: readonly string[]) =>
      `SRV${this.imei()},${command},‹ref›${fields.map((field) => `,${field}`).join('')}`;
    const step = (label: string, command: string, fields: readonly string[], write = false) => ({
      label,
      raw: frame(command, fields),
      write,
    });
    const snapshot = step(labels.snapshot, '45', ['0001', '0002', '…']);
    switch (value.kind) {
      case 'READ_ACTION': {
        const command = this.actionCommands().find((entry) => entry.action === value.action);
        return command ? [step(labels.send, command.command, command.fields)] : [];
      }
      case 'READ_PARAMETERS': {
        const codes = (value.readParameters ?? []).map((entry) => entry.code);
        return codes.length ? [step(labels.send, codes.length === 1 ? '03' : '45', codes)] : [];
      }
      case 'READ_EDATA':
        return [
          step(labels.definitions, '30', edataFields('301', '0702BC')),
          step(labels.globals, '30', edataFields('303', '')),
          step(labels.profile, '30', edataFields('301', '1F')),
        ];
      case 'SNAPSHOT':
        return [snapshot];
      case 'PARAMETER': {
        const parameter = value.parameter;
        if (!parameter) {
          return [];
        }
        const current = this.currentValue() ?? labels.capturedValue;
        return [
          snapshot,
          step(labels.baseline, '03', [parameter.code]),
          step(labels.preflight, '03', [parameter.code]),
          step(labels.write, '04', [parameter.code, value.value ?? ''], true),
          step(labels.readback, '03', [parameter.code]),
          ...(value.restoreAfter ? [step(labels.restore, '04', [parameter.code, current])] : []),
        ];
      }
      case 'EDATA_INTERVAL': {
        const entry = value.edataParameter;
        const interval = value.interval;
        if (!entry || interval === null || interval === undefined || !Number.isInteger(interval)) {
          return [];
        }
        const existing = this.existingDefinition();
        const intended = existing
          ? `${existing.definition.slice(0, 40)}${hex4(interval)}`
          : predefinedDefinition(entry.parameterId, interval);
        const read = edataFields('301', '0702BC');
        return [
          snapshot,
          step(labels.baseline, '30', read),
          step(labels.preflight, '30', read),
          step(labels.write, '30', edataFields('301', `02${intended}`), true),
          step(labels.readback, '30', read),
          ...(value.restoreAfter
            ? [
                step(
                  labels.restore,
                  '30',
                  edataFields(
                    '301',
                    existing ? `02${existing.definition}` : `10${hex4(entry.parameterId)}`,
                  ),
                ),
              ]
            : []),
        ];
      }
      case 'GLOBALS': {
        const globals = (value.globalsHex ?? '').trim().toUpperCase();
        if (!globals) {
          return [];
        }
        return [
          snapshot,
          step(labels.baseline, '30', edataFields('303', '')),
          step(labels.write, '30', edataFields('302', globals), true),
          step(labels.readback, '30', edataFields('303', '')),
          ...(value.restoreAfter
            ? [step(labels.restore, '30', edataFields('302', this.globals() ?? ''))]
            : []),
        ];
      }
      default:
        return [];
    }
  });

  protected readonly disabledReason = computed(() => {
    const value = this.formValue();
    const text = this.text();
    const kind = value.kind ?? 'READ_EDATA';
    const write = writeKinds.has(kind) || kind === 'SNAPSHOT';
    if (write ? !this.canWrite() : !this.canRead()) {
      return write ? text.engineerRequired : text.operatorRequired;
    }
    if (writeKinds.has(kind) && !this.writesEnabled()) {
      return text.writesDisabled;
    }
    if (!queuedKinds.has(kind) && !this.primary()) {
      return text.primaryRequired;
    }
    if (!queuedKinds.has(kind) && this.running()) {
      return text.running;
    }
    if (kind === 'READ_PARAMETERS') {
      const count = value.readParameters?.length ?? 0;
      if (!count) {
        return text.chooseParameter;
      }
      if (count > 20) {
        return text.readLimit;
      }
    }
    if (kind === 'PARAMETER') {
      if (!value.parameter) {
        return text.chooseParameter;
      }
      if (!value.parameter.writable) {
        return text.notWritable;
      }
      if (!value.value?.trim()) {
        return text.enterValue;
      }
    }
    if (kind === 'EDATA_INTERVAL') {
      const existing = this.existingDefinition();
      const interval = value.interval;
      if (!this.configured()) {
        return text.readEdataFirst;
      }
      if (!value.edataParameter) {
        return text.chooseParameter;
      }
      if (
        interval === null ||
        interval === undefined ||
        !Number.isInteger(interval) ||
        interval < 0 ||
        interval > 65000
      ) {
        return text.intervalRange;
      }
      if (existing ? existing.interval === interval : interval === 0) {
        return existing ? text.intervalUnchanged : text.intervalAdd;
      }
      if (!existing && (this.configured()?.length ?? 0) >= edataCapacity) {
        return text.capacityFull;
      }
    }
    if (kind === 'GLOBALS') {
      if (!this.globals()) {
        return text.readEdataFirst;
      }
      if (!/^[0-9A-Fa-f]{98}$/.test(value.globalsHex?.trim() ?? '')) {
        return text.globalsFormat;
      }
      if (value.globalsHex?.trim().toUpperCase() === this.globals()?.toUpperCase()) {
        return text.globalsUnchanged;
      }
    }
    return null;
  });
  protected readonly operationLabel = computed(() => {
    const kind = this.kind();
    if (kind === 'EDATA_INTERVAL') {
      const existing = this.existingDefinition();
      return !existing
        ? this.text().operations.add
        : this.formValue().interval === 0
          ? this.text().operations.disable
          : this.text().operations.interval;
    }
    return this.text().kinds[kind];
  });
  protected readonly isWrite = computed(() => writeKinds.has(this.kind()));
  protected readonly parameterMatches = computed(() =>
    interpolate(this.text().matches, {
      shown: this.parameterSuggestions().length,
      total: this.parameterTotal(),
    }),
  );
  protected readonly edataMatches = computed(() =>
    interpolate(this.text().matches, {
      shown: this.edataSuggestions().length,
      total: this.edataTotal(),
    }),
  );
  protected readonly profileHint = computed(() => {
    const profile = this.unitProfile();
    return profile === null
      ? this.text().profileUnknown
      : interpolate(this.text().profileReported, { id: profile });
  });
  protected readonly catalogHint = computed(() => {
    const label = this.catalogLabel();
    return label ? interpolate(this.text().catalog, { label }) : this.text().catalogMissing;
  });
  protected readonly intervalHint = computed(() => {
    const existing = this.existingDefinition();
    return existing
      ? interpolate(this.text().intervalCurrent, { interval: existing.interval })
      : this.text().intervalNew;
  });
  protected readonly capacity = computed(() =>
    interpolate(this.text().capacity, {
      used: this.configuredRows().length,
      total: edataCapacity,
    }),
  );
  protected readonly confirmMessage = computed(() =>
    interpolate(this.text().confirmMessage, {
      operation: this.operationLabel(),
      target: this.target(),
    }),
  );

  protected readonly confirmOpen = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Polling failures only; the next successful poll clears it. */
  protected readonly pollError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly followedRunId = signal<string | null>(null);
  protected readonly followedRun = computed(
    () => this.runs().find((run) => run.id === this.followedRunId()) ?? null,
  );
  protected readonly followedRequestId = signal<string | null>(null);
  protected readonly followedRequest = signal<Request | null>(null);

  constructor() {
    effect(() => {
      this.deviceId();
      untracked(() => {
        void this.loadReferences();
      });
    });
    effect((onCleanup) => {
      this.reload();
      const subscription = this.api
        .watchConfigurationChanges(this.deviceId(), () => !this.running())
        .valueChanges.subscribe({
          next: (result) => {
            if (result.dataState === 'complete' && !result.error) {
              this.pollError.set(null);
              this.runs.set(result.data.fleetDevice.ermConfigurationChanges);
              this.writesEnabled.set(result.data.fleetDevice.ermConfigurationWritesEnabled);
            } else if (result.error) {
              this.pollError.set(
                controlCenterError(result.error, this.language(), this.text().unavailable),
              );
            }
          },
          error: (error: unknown) => {
            this.pollError.set(controlCenterError(error, this.language(), this.text().unavailable));
          },
        });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      this.reload();
      const subscription = this.api
        .watchParameterBaseline(this.deviceId())
        .valueChanges.subscribe((result) => {
          if (result.dataState === 'complete' && !result.error) {
            this.snapshot.set(
              result.data.fleetDevice.ermParameterSnapshots.items.find(
                (snapshot) => snapshot.status !== 'RUNNING',
              ) ?? null,
            );
          }
        });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect((onCleanup) => {
      const id = this.followedRequestId();
      if (!id) {
        return;
      }
      const subscription = this.api
        .watchCommandRequest(id, () => finalRequest.has(this.followedRequest()?.status ?? ''))
        .valueChanges.subscribe((result) => {
          if (result.dataState === 'complete' && result.data.ermCommandRequest) {
            this.followedRequest.set(result.data.ermCommandRequest);
          }
        });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
    effect(() => {
      const profile = this.unitProfile();
      const profiles = this.profiles();
      untracked(() => {
        const match = profiles.find((entry) => entry.id === profile);
        if (match && this.form.controls.profile.value === null) {
          this.form.patchValue({ category: match.categoryId, profile: match.id });
        }
      });
    });
    effect(() => {
      const ids = (this.configured() ?? []).map((entry) => entry.parameter);
      const profileId = this.unitProfile();
      untracked(() => {
        if (ids.length) {
          void this.loadConfiguredNames(ids, profileId);
        }
      });
    });
  }

  private async loadReferences(): Promise<void> {
    try {
      const [commands, profiles] = await Promise.all([
        this.api.actionCommands(),
        this.api.edataProfiles(),
      ]);
      this.actionCommands.set(commands);
      this.profiles.set(profiles);
    } catch (error: unknown) {
      this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
    }
  }

  private async loadConfiguredNames(ids: number[], profileId: number | null): Promise<void> {
    try {
      const page = await this.api.searchEdataParameters({
        ids: ids.slice(0, 100),
        ...(profileId !== null && this.profiles().some((entry) => entry.id === profileId)
          ? { profileId }
          : {}),
        limit: 100,
      });
      this.catalogLabel.set(page.catalogLabel ?? null);
      this.configuredNames.set(new Map(page.items.map((item) => [item.parameterId, item.name])));
    } catch {
      this.configuredNames.set(new Map());
    }
  }

  protected async searchParameters(event: AutoCompleteCompleteEvent): Promise<void> {
    const sequence = ++this.searchSequence;
    try {
      const page = await this.api.searchParameterCatalog({
        search: event.query,
        feature: this.form.controls.feature.value,
        // Reads and writes both exclude routing, lock and secret parameters.
        writableOnly: true,
        limit: 20,
      });
      if (sequence === this.searchSequence) {
        this.parameterSuggestions.set([...page.items]);
        this.parameterTotal.set(page.total);
        this.features.set([...page.features]);
      }
    } catch (error: unknown) {
      this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
    }
  }

  protected async searchEdata(event: AutoCompleteCompleteEvent): Promise<void> {
    const sequence = ++this.searchSequence;
    const profileId = this.form.controls.profile.value;
    try {
      const page = await this.api.searchEdataParameters({
        search: event.query,
        ...(profileId === null ? {} : { profileId }),
        limit: 20,
      });
      if (sequence === this.searchSequence) {
        this.edataSuggestions.set([...page.items]);
        this.edataTotal.set(page.total);
        this.catalogLabel.set(page.catalogLabel ?? null);
      }
    } catch (error: unknown) {
      this.error.set(controlCenterError(error, this.language(), this.text().unavailable));
    }
  }

  protected selectParameter(): void {
    const parameter = this.form.controls.parameter.value;
    if (parameter && !this.form.controls.value.value) {
      this.form.controls.value.setValue(this.currentValue() ?? parameter.defaultValue ?? '');
    }
  }

  protected selectEdata(): void {
    const existing = this.existingDefinition();
    this.form.controls.interval.setValue(existing ? existing.interval : 60);
  }

  protected useConfigured(row: { parameter: number; interval: number; name: string; hex: string }) {
    this.form.patchValue({
      kind: 'EDATA_INTERVAL',
      edataParameter: {
        parameterId: row.parameter,
        hex: row.hex,
        name: row.name,
        category: '',
        multiply: null,
        offset: null,
      },
      interval: row.interval,
    });
  }

  protected editGlobals(): void {
    this.form.patchValue({ kind: 'GLOBALS', globalsHex: this.globals() ?? '' });
  }

  protected chooseKind(): void {
    this.followedRunId.set(null);
    this.followedRequestId.set(null);
    this.followedRequest.set(null);
    this.notice.set(null);
    this.error.set(null);
  }

  protected parameterCode(parameter: number): string {
    return String(parameter).padStart(4, '0');
  }

  protected parameterLabel(entry: CatalogEntry): string {
    return `${entry.code} · ${entry.title}`;
  }

  protected edataLabel(entry: EdataEntry): string {
    return `${String(entry.parameterId)} (0x${entry.hex}) · ${entry.name}`;
  }

  protected review(): void {
    if (!this.disabledReason() && !this.submitting() && this.steps().length) {
      this.confirmOpen.set(true);
    }
  }

  protected async send(): Promise<void> {
    if (this.disabledReason() || this.submitting()) {
      return;
    }
    const value = this.form.getRawValue();
    const deviceId = this.deviceId();
    this.confirmOpen.set(false);
    this.submitting.set(true);
    this.chooseKind();
    try {
      switch (value.kind) {
        case 'READ_ACTION':
        case 'READ_PARAMETERS': {
          const request = await this.api.sendCommand(
            value.kind === 'READ_ACTION'
              ? { deviceId, action: value.action }
              : {
                  deviceId,
                  action: 'READ_PARAMETERS',
                  parameters: value.readParameters.map((entry) => entry.parameter),
                },
          );
          this.followedRequest.set(request);
          this.followedRequestId.set(request.id);
          break;
        }
        case 'SNAPSHOT':
          await this.api.startSnapshot(deviceId);
          this.notice.set(this.text().snapshotStarted);
          break;
        case 'PARAMETER':
          if (value.parameter) {
            this.followedRunId.set(
              (
                await this.api.startParameterChange({
                  deviceId,
                  parameter: value.parameter.code,
                  value: value.value.trim(),
                  restoreAfter: value.restoreAfter,
                })
              ).id,
            );
          }
          break;
        case 'READ_EDATA':
          this.followedRunId.set((await this.api.startEdataChange({ deviceId, read: true })).id);
          break;
        case 'EDATA_INTERVAL': {
          const entry = value.edataParameter;
          const interval = value.interval;
          if (entry && interval !== null) {
            const run = this.existingDefinition()
              ? await this.api.startEdataChange({
                  deviceId,
                  parameterId: entry.parameterId,
                  intervalSeconds: interval,
                  restoreAfter: value.restoreAfter,
                })
              : await this.api.startEdataChange({
                  deviceId,
                  definitionHex: predefinedDefinition(entry.parameterId, interval),
                  restoreAfter: value.restoreAfter,
                });
            this.followedRunId.set(run.id);
          }
          break;
        }
        case 'GLOBALS':
          this.followedRunId.set(
            (
              await this.api.startEdataChange({
                deviceId,
                globalsHex: value.globalsHex.trim().toUpperCase(),
                restoreAfter: value.restoreAfter,
              })
            ).id,
          );
          break;
      }
    } catch (error: unknown) {
      this.error.set(controlCenterError(error, this.language(), this.text().uncertain));
    } finally {
      this.submitting.set(false);
      this.reload.update((count) => count + 1);
    }
  }

  protected link(tab: 'commands' | 'parameters'): string[] {
    return ['/', this.language(), this.branchId(), 'fleet', 'devices', this.deviceId(), tab];
  }
  protected runState(status: Run['status']): string {
    return this.common().settings.states[status];
  }
  protected runSeverity(status: Run['status']) {
    return toneSeverity(
      status === 'UNCERTAIN' || status === 'RESTORE_FAILED' || status === 'FAILED'
        ? 'danger'
        : status === 'MISMATCH' || status === 'REFUSED'
          ? 'warn'
          : status === 'RUNNING'
            ? 'info'
            : 'success',
    );
  }
  protected requestState(status: Request['status']): string {
    return this.common().queue.states[status];
  }
  protected requestSeverity(status: Request['status']) {
    return toneSeverity(
      status === 'ANSWERED'
        ? 'success'
        : status === 'FAILED' || status === 'UNCERTAIN'
          ? 'danger'
          : status === 'EXPIRED' || status === 'CANCELLED'
            ? 'warn'
            : 'info',
    );
  }
  protected stepName(name: string): string {
    const labels: Readonly<Record<string, string>> = this.common().settings.steps;
    return labels[name] ?? name;
  }
  protected runSteps(
    run: Run,
  ): readonly { name: string; outcome: string; payload: string | null }[] {
    if (!Array.isArray(run.steps)) {
      return [];
    }
    const entries: unknown[] = run.steps;
    return entries.flatMap((step) =>
      typeof step === 'object' &&
      step !== null &&
      'name' in step &&
      typeof step.name === 'string' &&
      'outcome' in step &&
      typeof step.outcome === 'string'
        ? [
            {
              name: step.name,
              outcome: step.outcome,
              payload: 'payload' in step && typeof step.payload === 'string' ? step.payload : null,
            },
          ]
        : [],
    );
  }
  protected reason(value: string | null | undefined): string {
    return controlCenterReason(value, this.language());
  }
}
