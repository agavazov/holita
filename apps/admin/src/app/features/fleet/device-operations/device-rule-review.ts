import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
  type OnInit,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  encodeRuleData,
  encodeRuleRecord,
  parseRuleExpression,
  referencedParameterIds,
} from '@holita/edata-rules';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Message } from 'primeng/message';
import type {
  AdminDeviceConfigurationOperationFragment,
  AdminRequestDeviceRuleChangeMutationVariables,
} from '../../../../generated/graphql/operations';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { draftRecord, type RuleDraft } from '../../karma-client/device-management/rule-drafts';
import type { DeviceConfigurationTarget } from './device-configuration-types';
import { deviceConfigurationText } from './i18n/messages';

@Component({
  selector: 'holita-device-rule-review',
  imports: [ReactiveFormsModule, ButtonDirective, Checkbox, Message, RouteDrawer],
  template: `
    <holita-route-drawer
      [title]="text().title"
      [subtitle]="target()?.carNumber ?? null"
      [closeLink]="null"
      size="lg"
      [dirty]="form.dirty"
      [saving]="submitting()"
      (closeRequest)="close()"
    >
      <p>{{ text().hint }}</p>
      @if (unavailable()) {
        <p-message severity="warn">{{ text().baselineRequired }}</p-message>
      }
      @if (stale()) {
        <p-message severity="warn">{{ text().stale }}</p-message>
      }
      @if (duplicateRuleId()) {
        <p-message severity="error">{{ text().duplicate }}</p-message>
      }
      @if (missing().length) {
        <p-message severity="error">{{ text().missing }} {{ missing().join(', ') }}</p-message>
      }
      @if (error()) {
        <p-message severity="error">{{ error() }}</p-message>
      }
      <dl class="app-facts">
        <div>
          <dt>{{ text().target }}</dt>
          <dd>{{ target()?.carNumber }}</dd>
        </div>
        <div>
          <dt>{{ text().change }}</dt>
          <dd>
            {{ previous() ? text().update : text().add }} · {{ text().ruleId }}
            {{ draft().ruleId }}
          </dd>
        </div>
        <div>
          <dt>{{ text().name }}</dt>
          <dd>{{ draft().name }}</dd>
        </div>
        <div class="app-facts--wide">
          <dt>{{ text().condition }}</dt>
          <dd>{{ expressionLabel() ?? draft().expression }}</dd>
        </div>
        @if (previous(); as previous) {
          <div class="app-facts--wide">
            <dt>{{ text().previousCondition }}</dt>
            <dd>{{ previousExpressionLabel() ?? previous.expression ?? '—' }}</dd>
          </div>
        }
        <div>
          <dt>{{ text().trueEvent }}</dt>
          <dd>
            @if (previous(); as previous) {
              {{ reportingLabel(previous.trueEventId) }} →
            }
            {{ reportingLabel(draft().trueEvent) }}
          </dd>
        </div>
        <div>
          <dt>{{ text().falseEvent }}</dt>
          <dd>
            @if (previous(); as previous) {
              {{ reportingLabel(previous.falseEventId) }} →
            }
            {{ reportingLabel(draft().falseEvent) }}
          </dd>
        </div>
        <div>
          <dt>{{ text().debounce }}</dt>
          <dd>
            @if (previous(); as previous) {
              {{ previous.debounceMilliseconds }} ms →
            }
            {{ draft().debounce }} ms
          </dd>
        </div>
      </dl>
      <details class="rule-details">
        <summary>{{ text().technicalDetails }}</summary>
        <dl class="app-facts">
          <div>
            <dt>{{ text().targetCarId }}</dt>
            <dd class="app-mono">{{ target()?.id }}</dd>
          </div>
          <div>
            <dt>{{ text().targetDeviceId }}</dt>
            <dd class="app-mono">{{ target()?.deviceId }}</dd>
          </div>
          <div>
            <dt>{{ text().dependencies }}</dt>
            <dd>{{ dependencies().join(', ') || '—' }}</dd>
          </div>
          <div>
            <dt>{{ text().catalog }}</dt>
            <dd>{{ draft().catalogVersion || '—' }}</dd>
          </div>
          <div>
            <dt>{{ text().dashboard }}</dt>
            <dd>{{ previous()?.activateDashboard ?? false }}</dd>
          </div>
          <div>
            <dt>{{ text().trueEvent }}</dt>
            <dd class="app-mono">{{ hex(draft().trueEvent) }}</dd>
          </div>
          <div>
            <dt>{{ text().falseEvent }}</dt>
            <dd class="app-mono">{{ hex(draft().falseEvent) }}</dd>
          </div>
          <div class="app-facts--wide">
            <dt>{{ text().expression }}</dt>
            <dd class="app-mono">{{ draft().expression }}</dd>
          </div>
          <div class="app-facts--wide">
            <dt>{{ text().oldDefinition }}</dt>
            <dd class="app-mono">{{ previous()?.definitionHex || '—' }}</dd>
          </div>
          <div class="app-facts--wide">
            <dt>{{ text().newDefinition }}</dt>
            <dd class="app-mono">{{ definition() }}</dd>
          </div>
          <div class="app-facts--wide">
            <dt>{{ text().rulesBaseline }}</dt>
            <dd class="app-mono">{{ rulesBaseline()?.id }}</dd>
          </div>
          <div class="app-facts--wide">
            <dt>{{ text().parameterBaseline }}</dt>
            <dd class="app-mono">{{ parameterBaseline()?.id }}</dd>
          </div>
        </dl>
      </details>
      <form id="rule-send" class="app-form-section" [formGroup]="form" (ngSubmit)="submit()">
        @if (draft().trueEvent === 0 || draft().falseEvent === 0) {
          <div class="app-inline">
            <p-checkbox inputId="rule-zero" formControlName="zero" [binary]="true" /><label
              for="rule-zero"
              >{{ text().zero }}</label
            >
          </div>
        }
        <div class="app-inline">
          <p-checkbox inputId="rule-confirm" formControlName="confirmed" [binary]="true" /><label
            for="rule-confirm"
            >{{ text().confirm }}</label
          >
        </div>
      </form>
      <div drawerFooter class="app-drawer-actions">
        <button
          pButton
          type="button"
          severity="secondary"
          [disabled]="submitting()"
          (click)="close()"
        >
          {{ text().cancel }}
        </button>
        <button
          pButton
          type="submit"
          form="rule-send"
          [disabled]="
            unavailable() ||
            stale() ||
            missing().length > 0 ||
            duplicateRuleId() ||
            !definition() ||
            submitting() ||
            form.invalid ||
            ((draft().trueEvent === 0 || draft().falseEvent === 0) && !form.controls.zero.value)
          "
        >
          {{ text().submit }}
        </button>
      </div>
    </holita-route-drawer>
  `,
  styles: `
    :host {
      display: contents;
    }
    dd {
      overflow-wrap: anywhere;
    }
    .rule-details > summary {
      cursor: pointer;
      color: var(--p-text-muted-color);
      padding-block: var(--p-app-space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceRuleReview implements OnInit {
  readonly draft = input.required<RuleDraft>();
  readonly branchId = input.required<string>();
  readonly target = input<DeviceConfigurationTarget | null>(null);
  readonly duplicateRuleId = input(false);
  readonly expressionLabel = input<string | null>(null);
  readonly previousExpressionLabel = input<string | null>(null);
  readonly rulesBaseline = input<AdminDeviceConfigurationOperationFragment | null>(null);
  readonly parameterBaseline = input<AdminDeviceConfigurationOperationFragment | null>(null);
  readonly unavailable = input(true);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly closeRequest = output();
  readonly send = output<AdminRequestDeviceRuleChangeMutationVariables['input']>();
  private readonly drawer = viewChild(RouteDrawer);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => deviceConfigurationText(this.language()).ruleEditor);
  protected readonly form = new FormGroup({
    confirmed: new FormControl(false, {
      nonNullable: true,
      validators: (control) => Validators.requiredTrue(control),
    }),
    zero: new FormControl(false, { nonNullable: true }),
  });
  protected readonly previous = computed(() =>
    this.rulesBaseline()?.rulesConfiguration?.rules.find(
      (rule) => rule.ruleId === this.draft().ruleId,
    ),
  );
  protected readonly dependencies = computed(() => {
    try {
      return referencedParameterIds(parseRuleExpression(this.draft().expression));
    } catch {
      return [];
    }
  });
  protected readonly missing = computed(() =>
    this.dependencies().filter(
      (id) =>
        !this.parameterBaseline()?.configuration?.parameters.some(
          (parameter) => parameter.parameterId === id,
        ),
    ),
  );
  protected readonly definition = computed(() => {
    try {
      return encodeRuleRecord({
        ...draftRecord(this.draft()),
        activateDashboard: this.previous()?.activateDashboard ?? false,
        ruleDataHex: encodeRuleData(parseRuleExpression(this.draft().expression)),
      });
    } catch {
      return '';
    }
  });
  private readonly identity = computed(() =>
    JSON.stringify([
      this.branchId(),
      this.target()?.id,
      this.target()?.deviceId,
      this.rulesBaseline()?.id,
      this.parameterBaseline()?.id,
      this.draft(),
    ]),
  );
  private initialIdentity = '';
  protected readonly stale = computed(() => this.identity() !== this.initialIdentity);
  protected readonly hex = (value: number) =>
    `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
  protected reportingLabel(value: number): string {
    return value === 0 ? this.text().noReport : `${this.text().eventCode} ${String(value)}`;
  }

  constructor() {
    effect(() => {
      this.identity();
      this.form.reset();
    });
  }
  ngOnInit(): void {
    this.initialIdentity = this.identity();
  }
  canLeave(): boolean | Promise<boolean> {
    return !this.submitting() && (this.drawer()?.confirmLeave(this.form.dirty) ?? true);
  }
  async close(): Promise<void> {
    if (await this.canLeave()) {
      this.closeRequest.emit();
    }
  }
  submit(): void {
    const target = this.target();
    const rules = this.rulesBaseline();
    const parameters = this.parameterBaseline();
    const draft = this.draft();
    if (
      this.unavailable() ||
      this.stale() ||
      this.submitting() ||
      this.missing().length ||
      this.duplicateRuleId() ||
      !this.definition() ||
      !target ||
      !rules ||
      !parameters ||
      draft.ruleId === undefined ||
      draft.opaque ||
      this.form.invalid ||
      ((draft.trueEvent === 0 || draft.falseEvent === 0) && !this.form.controls.zero.value)
    ) {
      this.form.markAllAsTouched();
      return;
    }
    this.send.emit({
      karmaCarId: target.id,
      expectedKarmaDeviceId: target.deviceId,
      baselineOperationId: rules.id,
      parameterBaselineOperationId: parameters.id,
      ruleId: draft.ruleId,
      expression: draft.expression,
      trueEventId: draft.trueEvent,
      falseEventId: draft.falseEvent,
      debounceMilliseconds: draft.debounce,
    });
  }
}
