import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Filter } from '@primeicons/angular/filter';
import { Search } from '@primeicons/angular/search';
import { Times } from '@primeicons/angular/times';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputNumber, type InputNumberPassThrough } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Popover } from 'primeng/popover';
import { Select } from 'primeng/select';
import { fromDateOnly, toDateOnly } from '../format/zoned-time';
import { interpolate, uiMessages } from '../i18n/messages';
import { maxSearchLength } from '../list/list-state';
import { selectMultiplePt } from '../select-multiple';
import { UI_LANGUAGE } from '../ui-language';
import { validationMessage } from '../forms/validators';
import {
  describeCondition,
  type FilterCondition,
  type FilterField,
  type FilterOperator,
  isComplete,
  filterValueErrors,
  operandsOf,
} from './filter-model';

type EditorKind =
  | 'none'
  | 'text'
  | 'enum-one'
  | 'enum-set'
  | 'number-one'
  | 'number-range'
  | 'date-one'
  | 'date-range';

let nextId = 0;
let nextCondition = 0;

/**
 * The filter row above a list: an always-visible quick search, plus "Add filter", which builds
 * conditions (column → condition → value). Conditions show as chips that open the same editor;
 * all of them apply together. The host passes only the columns and conditions its backend
 * supports and keeps search and conditions in its URL state.
 * Opening focuses Column; closing restores the opener unless focus moved outside the editor.
 */
@Component({
  selector: 'holita-filter-builder',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    DatePicker,
    IconField,
    InputIcon,
    InputNumber,
    InputText,
    Message,
    Popover,
    Select,
    Filter,
    Search,
    Times,
  ],
  templateUrl: './filter-builder.html',
  styleUrl: './filter-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBuilder {
  readonly searchLabel = input.required<string>();
  readonly search = input('');
  readonly searchError = input<string | null>(null);
  readonly fields = input<readonly FilterField[]>([]);
  readonly conditions = input<readonly FilterCondition[]>([]);
  readonly maxConditions = input<number | null>(null);
  readonly searchChange = output<string>();
  readonly conditionsChange = output<readonly FilterCondition[]>();

  protected readonly id = `filter-builder-${String(nextId++)}`;
  protected readonly maxLength = maxSearchLength;
  protected readonly selectMultiplePt = selectMultiplePt;
  protected readonly calendarPt = {
    day: { 'aria-selected': null },
    panel: {
      onkeydown: (event: KeyboardEvent) => {
        this.calendarEscape(event);
      },
    },
  };
  protected readonly open = signal(false);
  protected readonly editingId = signal<string | null>(null);
  private readonly popover = viewChild.required(Popover);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  private readonly chipButtons = viewChildren<ElementRef<HTMLButtonElement>>('chipButton');
  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  protected readonly text = computed(() => uiMessages[this.language()].filters);
  protected readonly common = computed(() => uiMessages[this.language()]);

  protected readonly form = new FormGroup({
    field: new FormControl('', { nonNullable: true }),
    operator: new FormControl<FilterOperator>('contains', { nonNullable: true }),
    text: new FormControl('', { nonNullable: true }),
    choices: new FormControl<string[]>([], { nonNullable: true }),
    from: new FormControl<number | null>(null),
    to: new FormControl<number | null>(null),
    fromDate: new FormControl<Date | null>(null),
    toDate: new FormControl<Date | null>(null),
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private loading = false;
  private opener: HTMLElement | null = null;
  private returnFocus = false;

  protected readonly fieldOptions = computed(() => [...this.fields()]);
  protected readonly canAdd = computed(() => {
    const limit = this.maxConditions();
    return limit === null || this.conditions().length < limit;
  });
  /** Native maxlength counts UTF-16 units; Apply enforces the code-point limit. */
  protected readonly textMaxLength = computed(() => {
    const max = this.field()?.maxLength;
    return max === undefined ? null : max * 2;
  });
  protected readonly field = computed(
    () => this.fields().find((field) => field.key === this.value().field) ?? null,
  );
  protected readonly operatorOptions = computed(() =>
    (this.field()?.operators ?? []).map((operator) => ({
      value: operator,
      label: this.text().operators[operator],
    })),
  );
  protected readonly choiceOptions = computed(() => [...(this.field()?.options ?? [])]);
  protected readonly editorKind = computed<EditorKind>(() => {
    const field = this.field();
    const operator = this.value().operator;
    if (!field || !operator) {
      return 'none';
    }
    const operands = operandsOf(operator);
    if (operands === 'none') {
      return 'none';
    }
    if (field.type === 'enum') {
      return operands === 'set' ? 'enum-set' : 'enum-one';
    }
    if (field.type === 'number') {
      return operands === 'range' ? 'number-range' : 'number-one';
    }
    if (field.type === 'date') {
      return operands === 'range' ? 'date-range' : 'date-one';
    }
    return 'text';
  });
  protected readonly draft = computed<FilterCondition | null>(() => {
    const field = this.field();
    if (!field) {
      return null;
    }
    const value = this.form.getRawValue();
    this.value();
    const number = (input: number | null) => (input === null ? '' : String(input));
    const date = (input: Date | null) => (input ? toDateOnly(input) : '');
    const values = ((): string[] => {
      switch (this.editorKind()) {
        case 'none':
          return [];
        case 'enum-set':
          return value.choices;
        case 'number-one':
          return [number(value.from)];
        case 'number-range':
          return [number(value.from), number(value.to)];
        case 'date-one':
          return [date(value.fromDate)];
        case 'date-range':
          return [date(value.fromDate), date(value.toDate)];
        default:
          return [value.text.trim()];
      }
    })();
    return { id: this.editingId() ?? '', field: field.key, operator: value.operator, values };
  });
  protected readonly canApply = computed(() => {
    const field = this.field();
    const draft = this.draft();
    return (
      !!field &&
      !!draft &&
      field.operators.includes(draft.operator) &&
      isComplete(field, draft) &&
      (this.canAdd() ||
        (this.editingId() !== null && this.conditions().length === this.maxConditions()))
    );
  });
  protected readonly valueError = computed(() => {
    const field = this.field();
    const draft = this.draft();
    return field && draft
      ? validationMessage(filterValueErrors(field, draft.values), this.language())
      : null;
  });
  /** Native hints expose bounds without InputNumber clamping invalid drafts on blur. */
  protected readonly numberPt = computed<InputNumberPassThrough>(() => {
    const field = this.field();
    return {
      pcInputText: {
        root: {
          ...(field?.min === undefined
            ? {}
            : { min: String(field.min), 'aria-valuemin': field.min }),
          ...(field?.max === undefined
            ? {}
            : { max: String(field.max), 'aria-valuemax': field.max }),
          inputmode: field?.integer ? 'numeric' : 'decimal',
          step: field?.integer ? '1' : 'any',
        },
      },
    };
  });
  protected readonly chips = computed(() =>
    this.conditions().flatMap((condition) => {
      const field = this.fields().find((candidate) => candidate.key === condition.field);
      return field
        ? [{ id: condition.id, label: describeCondition(field, condition, this.language()) }]
        : [];
    }),
  );

  constructor() {
    // A new column starts with its default condition and no values.
    this.form.controls.field.valueChanges.pipe(takeUntilDestroyed()).subscribe((key) => {
      if (this.loading) {
        return;
      }
      const field = this.fields().find((candidate) => candidate.key === key);
      this.form.patchValue({
        operator: field?.operators[0] ?? 'contains',
        text: '',
        choices: [],
        from: null,
        to: null,
        fromDate: null,
        toDate: null,
      });
    });
  }

  protected inputSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchChange.emit(event.target.value);
    }
  }

  protected openNew(event: Event): void {
    if (!this.canAdd()) {
      return;
    }
    this.editingId.set(null);
    this.load(this.fields()[0]?.key ?? '', null);
    this.show(event);
  }

  protected edit(id: string, event: Event): void {
    const condition = this.conditions().find((candidate) => candidate.id === id);
    if (!condition) {
      return;
    }
    this.editingId.set(id);
    this.load(condition.field, condition);
    this.show(event);
  }

  protected apply(): void {
    const draft = this.draft();
    if (!draft || !this.canApply()) {
      return;
    }
    const editing = this.editingId();
    let id = editing;
    if (id === null) {
      const used = new Set(this.conditions().map((condition) => condition.id));
      // URL-restored conditions can predate this browser session's counter.
      do {
        id = `condition-${String(nextCondition++)}`;
      } while (used.has(id));
    }
    const condition = { ...draft, id };
    this.conditionsChange.emit(
      editing
        ? this.conditions().map((candidate) => (candidate.id === editing ? condition : candidate))
        : [...this.conditions(), condition],
    );
    this.close();
  }

  protected cancel(): void {
    this.close();
  }

  protected calendarEscape(event: Event): void {
    if (event instanceof KeyboardEvent && event.key === 'Escape' && event.defaultPrevented) {
      event.stopPropagation();
    }
  }

  protected remove(id: string): void {
    const index = this.chips().findIndex((chip) => chip.id === id);
    const buttons = this.chipButtons();
    const target = buttons[index + 1] ?? buttons[index - 1] ?? this.addButton();
    target?.nativeElement.focus();
    this.conditionsChange.emit(this.conditions().filter((condition) => condition.id !== id));
  }

  protected clearAll(): void {
    const add = this.addButton()?.nativeElement;
    if (add?.disabled) {
      afterNextRender(
        () => {
          add.focus();
        },
        { injector: this.injector },
      );
    } else {
      add?.focus();
    }
    this.conditionsChange.emit([]);
  }

  protected shown(): void {
    this.open.set(true);
    this.focusFirstControl();
  }

  protected closed(): void {
    this.open.set(false);
    if (
      (this.returnFocus || this.formElement().nativeElement.contains(document.activeElement)) &&
      this.opener?.isConnected
    ) {
      this.opener.focus();
    }
    this.opener = null;
    this.returnFocus = false;
  }

  private show(event: Event): void {
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.returnFocus = false;
    const wasOpen = this.open();
    this.popover().show(event);
    if (wasOpen) {
      this.popover().align();
      this.focusFirstControl();
    }
  }

  private close(): void {
    this.returnFocus = true;
    this.popover().hide();
  }

  private focusFirstControl(): void {
    this.formElement().nativeElement.querySelector<HTMLElement>(`#${this.id}-field`)?.focus();
  }

  protected chipEditLabel(label: string): string {
    return interpolate(this.text().editChip, { name: label });
  }

  protected chipRemoveLabel(label: string): string {
    return interpolate(this.text().removeChip, { name: label });
  }

  private load(key: string, condition: FilterCondition | null): void {
    const field = this.fields().find((candidate) => candidate.key === key);
    const values = condition?.values ?? [];
    const number = (index: number) => {
      const text = values[index];
      return text === undefined || text === '' ? null : Number(text);
    };
    this.loading = true;
    try {
      this.form.setValue({
        field: key,
        operator: condition?.operator ?? field?.operators[0] ?? 'contains',
        text: field?.type === 'text' || field?.type === 'enum' ? (values[0] ?? '') : '',
        choices: [...values],
        from: field?.type === 'number' ? number(0) : null,
        to: field?.type === 'number' ? number(1) : null,
        fromDate: field?.type === 'date' ? fromDateOnly(values[0]) : null,
        toDate: field?.type === 'date' ? fromDateOnly(values[1]) : null,
      });
    } finally {
      this.loading = false;
    }
  }
}
