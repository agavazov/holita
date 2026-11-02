import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  encodeRuleRecord,
  parseRuleExpression,
  renderRuleExpression,
  type RuleExpression,
  type RuleOperator,
} from '@holita/edata-rules';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { randomUuid } from '../../../core/random-uuid';
import type { Language } from '../../../i18n/messages';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { integerValidator } from '../../../ui/forms/validators';
import { draftRecord, type RuleDraft, type RuleParameterName } from './rule-drafts';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

const comparisons: readonly RuleOperator[] = ['=', '!=', '>', '<', '>=', '<='];
interface ConditionValue {
  readonly parameter: number | null;
  readonly operator: RuleOperator;
  readonly otherParameter: boolean;
  readonly operand: number | null;
  readonly value: number | null;
}
function conditionForm(value?: ConditionValue) {
  return new FormGroup({
    parameter: new FormControl<number | null>(
      value?.parameter ?? null,
      integerValidator(0, 65535, { required: true }),
    ),
    operator: new FormControl<RuleOperator>(value?.operator ?? '>', { nonNullable: true }),
    otherParameter: new FormControl(value?.otherParameter ?? false, { nonNullable: true }),
    operand: new FormControl<number | null>(value?.operand ?? null, integerValidator(0, 65535)),
    value: new FormControl<number | null>(
      value?.value ?? null,
      integerValidator(-65535, 2147483647),
    ),
  });
}
function simpleCondition(node: RuleExpression): ConditionValue | null {
  if (
    node.kind !== 'operator' ||
    !comparisons.includes(node.operator) ||
    node.children.length !== 2
  ) {
    return null;
  }
  const [left, right] = node.children;
  if (
    left?.kind !== 'parameter' ||
    !right ||
    (right.kind !== 'parameter' && right.kind !== 'integer')
  ) {
    return null;
  }
  return {
    parameter: left.parameterId,
    operator: node.operator,
    otherParameter: right.kind === 'parameter',
    operand: right.kind === 'parameter' ? right.parameterId : null,
    value: right.kind === 'integer' ? right.value : null,
  };
}

function simpleConditions(
  ast: RuleExpression,
): { operator: 'and' | 'or'; rows: ConditionValue[] } | null {
  const single = simpleCondition(ast);
  if (single) {
    return { operator: 'and', rows: [single] };
  }
  if (ast.kind !== 'operator' || (ast.operator !== 'and' && ast.operator !== 'or')) {
    return null;
  }
  const operator = ast.operator;
  const rows: ConditionValue[] = [];
  const visit = (node: RuleExpression): boolean => {
    if (node.kind === 'operator' && node.operator === operator && node.children.length === 2) {
      return node.children.every(visit);
    }
    const row = simpleCondition(node);
    if (!row) {
      return false;
    }
    rows.push(row);
    return true;
  };
  return visit(ast) ? { operator, rows } : null;
}

/** One business form for local rule revisions; its host saves drafts and reviews device writes. */
@Component({
  selector: 'holita-device-rule-editor',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    InputNumber,
    InputText,
    Message,
    Select,
    Textarea,
    RouteDrawer,
    FormField,
  ],
  templateUrl: './device-rule-editor.html',
  styleUrl: './device-rule-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceRuleEditor implements OnInit {
  readonly language = input.required<Language>();
  readonly carNumber = input.required<string>();
  readonly draft = input<RuleDraft | null>(null);
  readonly parameters = input<readonly RuleParameterName[]>([]);
  readonly occupiedIds = input<readonly number[]>([]);
  readonly catalogVersion = input<string | null>(null);
  readonly canSend = input(false);
  readonly newRuleId = input(0);
  protected readonly step = signal(0);
  readonly save = output<{ draft: RuleDraft; review: boolean }>();
  readonly closeRequest = output();
  private readonly drawer = viewChild(RouteDrawer);
  private initializing = false;
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly advancedExpression = signal(false);
  protected readonly expressionError = signal(false);
  protected readonly attempted = signal(false);
  protected readonly conditions = new FormArray([conditionForm()]);
  protected readonly groupOperator = new FormControl<'and' | 'or'>('and', { nonNullable: true });
  protected readonly form = new FormGroup({
    ruleId: new FormControl<number | null>(null, integerValidator(0, 65535, { required: true })),
    name: new FormControl('', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    expression: new FormControl('', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    trueEnabled: new FormControl(true, { nonNullable: true }),
    trueEvent: new FormControl<number | null>(null),
    falseEnabled: new FormControl(false, { nonNullable: true }),
    falseEvent: new FormControl<number | null>(null),
    calculationOnly: new FormControl(false, { nonNullable: true }),
    debounce: new FormControl(1000, {
      nonNullable: true,
      validators: integerValidator(1, 32767, { required: true }),
    }),
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly parameterOptions = computed(() =>
    this.parameters().map((row) => ({ label: `${row.name} [${String(row.id)}]`, value: row.id })),
  );
  protected readonly operatorOptions = computed(() => {
    const text = this.text();
    const labels: Partial<Record<RuleOperator, string>> = {
      '=': text.equalTo,
      '!=': text.notEqualTo,
      '>': text.greaterThan,
      '<': text.lessThan,
      '>=': text.atLeast,
      '<=': text.atMost,
    };
    return comparisons.map((operator) => ({ label: labels[operator], value: operator }));
  });
  protected readonly groupingOptions = computed(() => [
    { label: this.text().allConditions, value: 'and' },
    { label: this.text().anyCondition, value: 'or' },
  ]);
  protected readonly preview = computed(() => {
    const expression = this.value().expression ?? '';
    return expression
      .replace(
        /\[(\d+)\]/g,
        (_match: string, id: string) =>
          this.parameters().find((row) => row.id === Number(id))?.name ?? `[${id}]`,
      )
      .replace(
        />=|<=|!=|=|>|</g,
        (operator) =>
          this.operatorOptions().find((row) => row.value === operator)?.label ?? operator,
      )
      .replace(/\band\b/g, this.text().and)
      .replace(/\bor\b/g, this.text().or);
  });
  protected readonly editingExisting = computed(() => {
    const id = this.draft()?.ruleId;
    return id !== undefined && this.occupiedIds().includes(id);
  });
  protected readonly replacement = computed(() => {
    const id = this.value().ruleId;
    return id !== null && id !== undefined && this.occupiedIds().includes(id);
  });
  protected readonly reportingValid = computed(() => {
    const value = this.value();
    if (value.calculationOnly) {
      return true;
    }
    return (
      !!(value.trueEnabled || value.falseEnabled) &&
      (!value.trueEnabled || (Number.isInteger(value.trueEvent) && (value.trueEvent ?? 0) > 0)) &&
      (!value.falseEnabled || (Number.isInteger(value.falseEvent) && (value.falseEvent ?? 0) > 0))
    );
  });

  constructor() {
    for (const control of [
      this.form.controls.trueEnabled,
      this.form.controls.falseEnabled,
      this.form.controls.calculationOnly,
    ]) {
      control.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        this.updateReportingValidators();
      });
    }
    this.updateReportingValidators();
    this.conditions.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.updateExpression();
    });
    this.groupOperator.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.updateExpression();
    });
    this.form.controls.expression.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      try {
        if (value) {
          parseRuleExpression(value);
        }
        this.expressionError.set(false);
      } catch {
        this.expressionError.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.initializing = true;
    const draft = this.draft();
    if (draft) {
      this.form.reset({
        ruleId: draft.ruleId ?? null,
        name: draft.name,
        expression: draft.expression,
        trueEnabled: draft.trueEvent > 0,
        trueEvent: draft.trueEvent || null,
        falseEnabled: draft.falseEvent > 0,
        falseEvent: draft.falseEvent || null,
        calculationOnly: draft.trueEvent === 0 && draft.falseEvent === 0,
        debounce: draft.debounce,
      });
      try {
        const simple = simpleConditions(parseRuleExpression(draft.expression));
        if (simple) {
          this.conditions.clear({ emitEvent: false });
          for (const row of simple.rows) {
            this.conditions.push(conditionForm(row), { emitEvent: false });
          }
          this.groupOperator.setValue(simple.operator, { emitEvent: false });
        } else {
          this.advancedExpression.set(true);
        }
      } catch {
        this.advancedExpression.set(true);
        this.expressionError.set(true);
      }
    }
    if (!draft) {
      this.form.controls.ruleId.setValue(this.newRuleId());
    }
    if (!this.parameterOptions().length) {
      this.advancedExpression.set(true);
    }
    this.updateReportingValidators();
    this.initializing = false;
  }

  private updateReportingValidators(): void {
    const value = this.form.getRawValue();
    this.form.controls.trueEvent.setValidators(
      !value.calculationOnly && value.trueEnabled
        ? integerValidator(1, 65535, { required: true })
        : null,
    );
    this.form.controls.falseEvent.setValidators(
      !value.calculationOnly && value.falseEnabled
        ? integerValidator(1, 65535, { required: true })
        : null,
    );
    this.form.controls.trueEvent.updateValueAndValidity({ emitEvent: false });
    this.form.controls.falseEvent.updateValueAndValidity({ emitEvent: false });
  }

  protected addCondition(): void {
    this.conditions.push(conditionForm());
    this.form.markAsDirty();
  }

  protected removeCondition(index: number): void {
    this.conditions.removeAt(index);
    this.form.markAsDirty();
  }

  protected useExpressionText(): void {
    this.advancedExpression.set(true);
    this.step.set(0);
  }

  private updateExpression(): void {
    if (this.initializing || this.advancedExpression()) {
      return;
    }
    const nodes: RuleExpression[] = [];
    for (const row of this.conditions.controls) {
      const value = row.getRawValue();
      if (
        row.controls.parameter.invalid ||
        (value.otherParameter ? row.controls.operand.invalid : row.controls.value.invalid) ||
        value.parameter === null ||
        (value.otherParameter ? value.operand === null : value.value === null)
      ) {
        this.form.controls.expression.setValue('');
        this.form.controls.expression.markAsDirty();
        return;
      }
      const right: RuleExpression | null = value.otherParameter
        ? value.operand === null
          ? null
          : { kind: 'parameter', parameterId: value.operand }
        : value.value === null
          ? null
          : { kind: 'integer', value: value.value };
      if (right) {
        nodes.push({
          kind: 'operator',
          operator: value.operator,
          children: [{ kind: 'parameter', parameterId: value.parameter }, right],
        });
      }
    }
    const first = nodes[0];
    const ast = nodes
      .slice(1)
      .reduce<RuleExpression | null>(
        (left, right) =>
          left
            ? { kind: 'operator', operator: this.groupOperator.value, children: [left, right] }
            : right,
        first ?? null,
      );
    this.form.controls.expression.setValue(ast ? renderRuleExpression(ast) : '');
    this.form.controls.expression.markAsDirty();
  }

  protected nextStep(): void {
    this.attempted.set(true);
    this.form.controls.name.markAsTouched();
    this.form.controls.expression.markAsTouched();
    this.form.controls.debounce.markAsTouched();
    this.conditions.markAllAsTouched();
    if (
      this.form.controls.name.invalid ||
      this.form.controls.expression.invalid ||
      this.form.controls.debounce.invalid ||
      this.expressionError()
    ) {
      return;
    }
    this.attempted.set(false);
    this.step.set(1);
  }

  protected submit(review = true): void {
    if (this.step() === 0) {
      this.nextStep();
      return;
    }
    this.attempted.set(true);
    this.form.markAllAsTouched();
    this.conditions.markAllAsTouched();
    if (
      this.form.invalid ||
      !this.reportingValid() ||
      this.expressionError() ||
      (review && !this.canSend())
    ) {
      return;
    }
    const value = this.form.getRawValue();
    if (value.ruleId === null) {
      return;
    }
    try {
      const previous = this.draft();
      const version = this.catalogVersion() ?? previous?.catalogVersion;
      const draft: RuleDraft = {
        ...previous,
        id: previous && !previous.confirmed ? previous.id : randomUuid(),
        ruleId: value.ruleId,
        name: value.name,
        expression: renderRuleExpression(parseRuleExpression(value.expression)),
        trueEvent: !value.calculationOnly && value.trueEnabled ? (value.trueEvent ?? 0) : 0,
        falseEvent: !value.calculationOnly && value.falseEnabled ? (value.falseEvent ?? 0) : 0,
        debounce: value.debounce,
        activateDashboard: previous?.activateDashboard ?? false,
        confirmed: false,
        ...(version ? { catalogVersion: version } : {}),
      };
      encodeRuleRecord(draftRecord(draft));
      this.save.emit({ draft, review });
    } catch {
      this.expressionError.set(true);
    }
  }

  canLeave(): boolean | Promise<boolean> {
    return this.drawer()?.confirmLeave(this.form.dirty) ?? true;
  }

  protected async close(): Promise<void> {
    if (await this.canLeave()) {
      this.closeRequest.emit();
    }
  }
}
