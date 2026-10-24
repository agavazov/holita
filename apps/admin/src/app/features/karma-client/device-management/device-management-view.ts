import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import type {
  AdminKarmaCarsQuery,
  FleetDeviceOperationStatus,
} from '../../../../generated/graphql/operations';
import type { Language } from '../../../i18n/messages';
import { KarmaCarHeader } from '../car-header/karma-car-header';
import { TablePanel } from '../../../ui/table-panel/table-panel';
import type { TableView } from '../../../ui/table-panel/table-view';
import { RowActions } from '../../../ui/row-actions/row-actions';
import type { ListActionBase, ListActionRequest, ListRecord } from '../../../ui/list/list-actions';
import { FormField } from '../../../ui/form-field/form-field';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormatNumberPipe } from '../../../ui/format/format.pipes';
import { integerValidator } from '../../../ui/forms/validators';
import { deviceConfigurationText } from '../../fleet/device-operations/i18n/messages';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

export interface ParameterSetting {
  readonly id: number;
  readonly name: string;
  readonly interval: number;
}
export interface RuleDraft {
  readonly id: string;
  readonly name: string;
  readonly expression: string;
  readonly trueEvent: number;
  readonly falseEvent: number;
  readonly debounce: number;
  readonly sourceHex?: string;
  readonly opaque?: boolean;
}
export interface DeviceOperationPreview {
  readonly id: string;
  readonly status: FleetDeviceOperationStatus;
}

/** Reusable presentation; its host owns drafts, persistence and device operation outcomes. */
@Component({
  selector: 'holita-device-management-view',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    Textarea,
    Select,
    Message,
    Tag,
    TableModule,
    KarmaCarHeader,
    TablePanel,
    RowActions,
    FormField,
    RouteDrawer,
    FormatNumberPipe,
  ],
  templateUrl: './device-management-view.html',
  styleUrl: './device-management-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceManagementView {
  readonly language = input.required<Language>();
  readonly car = input.required<AdminKarmaCarsQuery['karmaCars'][number]>();
  readonly parameters = input<ParameterSetting[]>([]);
  readonly catalog = input<ParameterSetting[]>([]);
  readonly rules = input<RuleDraft[]>([]);
  readonly operations = input<DeviceOperationPreview[]>([]);
  readonly branch = input<string | null>(null);
  readonly branchId = input<string | null>(null);
  readonly branchOptions = input<{ label: string; value: string }[]>([]);
  readonly branchChange = output<string | null>();
  readonly state = input<'ready' | 'loading' | 'error'>('ready');
  readonly notice = input<string | null>(null);
  readonly retry = output();
  readonly parameterChange = output<ParameterSetting>();
  readonly ruleChange = output<RuleDraft>();
  readonly ruleRemoval = output<string>();
  readonly sendRequest = output();
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly statusText = computed(() => deviceConfigurationText(this.language()).statuses);
  protected readonly editing = signal<'parameter' | 'rule' | null>(null);
  private readonly editingRuleId = signal<string | null>(null);
  protected readonly editingSourceHex = signal<string | undefined>(undefined);
  protected readonly ruleActions = computed<readonly ListActionBase<string>[]>(() => [
    { id: 'edit', label: this.text().edit },
    { id: 'duplicate', label: this.text().duplicate },
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
    { id: 'edit', label: this.text().edit },
  ]);
  protected readonly parameterOptions = computed(() =>
    this.catalog().map((row) => ({ label: row.name, value: row.id })),
  );
  protected readonly operators = ['=', '!=', '>', '<', '>=', '<='];
  protected readonly parameterView = computed<TableView>(() => {
    const state = this.state();
    return { kind: state === 'ready' ? (this.parameters().length ? 'rows' : 'empty') : state };
  });
  protected readonly ruleView = computed<TableView>(() => {
    const state = this.state();
    return { kind: state === 'ready' ? (this.rules().length ? 'rows' : 'empty') : state };
  });
  protected readonly arithmetic = ['+', '-', '*', '/', 'mod', '--'];
  protected readonly functions = ['TimeOf', 'Count', 'Sum'];
  private readonly drawer = viewChild(RouteDrawer);
  protected readonly scopeControl = new FormControl<string | null>(null);
  protected readonly parameterForm = new FormGroup({
    id: new FormControl(718, {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    interval: new FormControl(60, {
      nonNullable: true,
      validators: integerValidator(0, 65000, { required: true }),
    }),
  });
  protected readonly ruleForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    expression: new FormControl('', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    trueEvent: new FormControl(0, {
      nonNullable: true,
      validators: integerValidator(0, 65535, { required: true }),
    }),
    falseEvent: new FormControl(0, {
      nonNullable: true,
      validators: integerValidator(0, 65535, { required: true }),
    }),
    debounce: new FormControl(1, {
      nonNullable: true,
      validators: integerValidator(1, 32767, { required: true }),
    }),
  });
  protected readonly condition = new FormGroup({
    parameter: new FormControl(718, { nonNullable: true }),
    operator: new FormControl('>', { nonNullable: true }),
    value: new FormControl(10, {
      nonNullable: true,
      validators: integerValidator(-65535, 2147483647, { required: true }),
    }),
    otherParameter: new FormControl(false, { nonNullable: true }),
    operand: new FormControl(748, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      this.scopeControl.setValue(this.branchId(), { emitEvent: false });
    });
    this.scopeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.branchChange.emit(value);
    });
  }

  protected record(row: {
    readonly id: string | number;
    readonly name: string;
    readonly opaque?: boolean;
  }): ListRecord<string> {
    return {
      id: String(row.id),
      label: row.name,
      unavailable: row.opaque ? ['edit', 'duplicate'] : [],
    };
  }
  protected displayExpression(value: string): string {
    return value
      .replace(
        /\[(\d+)\]/g,
        (_match: string, id: string) =>
          this.catalog().find((row) => row.id === Number(id))?.name ??
          `${this.text().unknownParameter} ${id}`,
      )
      .replace(/\band\b/g, this.text().and)
      .replace(/\bor\b/g, this.text().or);
  }
  protected openParameter(id?: string): void {
    const row = this.parameters().find((item) => String(item.id) === id) ?? this.catalog()[0];
    this.parameterForm.reset({ id: row?.id ?? 718, interval: row?.interval ?? 60 });
    this.editing.set('parameter');
  }
  protected openRule(row?: RuleDraft): void {
    this.editingRuleId.set(row?.id ?? null);
    this.editingSourceHex.set(row?.sourceHex);
    this.ruleForm.reset({
      name: row?.name ?? '',
      expression: row?.expression ?? '',
      trueEvent: row?.trueEvent ?? 0,
      falseEvent: row?.falseEvent ?? 0,
      debounce: row?.debounce ?? 1,
    });
    this.editing.set('rule');
  }
  protected ruleAction(event: ListActionRequest<string>): void {
    const rule = this.rules().find((row) => row.id === event.ids[0]);
    if (!rule) {
      return;
    }
    if (event.action === 'remove') {
      this.ruleRemoval.emit(rule.id);
    } else if (event.action === 'duplicate') {
      this.openRule({
        ...rule,
        id: crypto.randomUUID(),
        name: `${rule.name} · ${this.text().copy}`,
      });
    } else if (!rule.opaque) {
      this.openRule(rule);
    }
  }
  protected async closeEditor(): Promise<void> {
    const dirty = this.editing() === 'rule' ? this.ruleForm.dirty : this.parameterForm.dirty;
    if (await this.drawer()?.confirmLeave(dirty)) {
      this.editing.set(null);
    }
  }
  protected saveParameter(): void {
    this.parameterForm.markAllAsTouched();
    if (this.parameterForm.invalid) {
      return;
    }
    const value = this.parameterForm.getRawValue();
    const row = this.catalog().find((item) => item.id === value.id);
    if (row) {
      this.parameterChange.emit({ ...row, interval: value.interval });
    }
    this.editing.set(null);
  }
  protected saveRule(): void {
    this.ruleForm.markAllAsTouched();
    if (this.ruleForm.invalid) {
      return;
    }
    const sourceHex = this.editingSourceHex();
    this.ruleChange.emit({
      id: this.editingRuleId() ?? crypto.randomUUID(),
      ...this.ruleForm.getRawValue(),
      ...(sourceHex ? { sourceHex } : {}),
    });
    this.editing.set(null);
  }
  protected appendCondition(join: 'and' | 'or' | null): void {
    if (!this.condition.controls.otherParameter.value && this.condition.controls.value.invalid) {
      this.condition.controls.value.markAsTouched();
      return;
    }
    const value = this.condition.getRawValue();
    const operand = value.otherParameter ? `[${String(value.operand)}]` : String(value.value);
    const expression = `[${String(value.parameter)}] ${value.operator} ${operand}`;
    const current = this.ruleForm.controls.expression.value;
    this.changeExpression(join && current ? `(${current}) ${join} (${expression})` : expression);
  }
  protected changeExpression(value: string): void {
    this.ruleForm.controls.expression.setValue(value);
    this.ruleForm.controls.expression.markAsDirty();
  }
  protected wrap(name = ''): void {
    const value = this.ruleForm.controls.expression.value;
    this.changeExpression(`${name ? '$' + name : ''}(${value})`);
  }
  protected appendOperator(operator: string): void {
    this.changeExpression(`${this.ruleForm.controls.expression.value} ${operator} `);
  }
}
