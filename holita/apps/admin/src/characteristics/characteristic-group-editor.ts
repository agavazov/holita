import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type AbstractControl,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FormField,
  RouteDrawer,
  drawerRouteData,
  fieldErrors,
  focusFirstInvalid,
  injectDrawerHost,
  integerValidator,
  lockWhileSaving,
  selectMultiplePt,
  textValidator,
  uiMessages,
  validationMessage,
  type RouteDrawerState,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { CategoriesApi } from '../categories/categories-api';
import { categoryRows } from '../categories/category-tree';
import type {
  CharacteristicKind,
  OperatorCharacteristicGroupQuery,
} from '../generated/characteristics-operations';
import { CharacteristicsApi } from './characteristics-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Group = NonNullable<OperatorCharacteristicGroupQuery['characteristicGroup']>;

function definitionFields(definition?: Pick<Group, 'name' | 'sortOrder' | 'active'>) {
  return {
    name: new FormControl(definition?.name ?? '', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
    sortOrder: new FormControl<number | null>(definition?.sortOrder ?? 0, {
      validators: [integerValidator(0, 2_147_483_647, { required: true })],
    }),
    active: new FormControl(definition?.active ?? true, { nonNullable: true }),
  };
}

function choiceForm(choice?: Group['characteristics'][number]['choices'][number]) {
  return new FormGroup({
    id: new FormControl(choice?.id ?? null),
    name: new FormControl(choice?.name ?? '', {
      nonNullable: true,
      validators: [textValidator(200, { required: true })],
    }),
  });
}

function characteristicForm(definition?: Group['characteristics'][number]) {
  return new FormGroup({
    ...definitionFields(definition),
    id: new FormControl(definition?.id ?? null),
    kind: new FormControl<CharacteristicKind>(definition?.kind ?? 'TEXT', { nonNullable: true }),
    choices: new FormArray((definition?.choices ?? []).map(choiceForm)),
  });
}

type CharacteristicForm = ReturnType<typeof characteristicForm>;

@Component({
  selector: 'holita-characteristic-group-editor',
  imports: [
    ButtonDirective,
    FormField,
    InputText,
    Message,
    ReactiveFormsModule,
    RouteDrawer,
    Select,
    ToggleSwitch,
  ],
  templateUrl: './characteristic-group-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacteristicGroupEditor {
  private readonly api = inject(CharacteristicsApi);
  private readonly categoriesApi = inject(CategoriesApi);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(OperatorLanguage);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  protected readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('editorForm');
  private readonly routeData = drawerRouteData(this.route);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly editing = this.routeData.mode === 'edit';
  private readonly id = computed(() => this.params().get(this.routeData.recordParam ?? 'recordId'));
  protected readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const id = this.id();
      return scope && id && uuid.test(id) ? { scope, id } : undefined;
    },
    loader: ({ params }) => this.api.find(params.scope, params.id),
  });
  protected readonly categories = resource({
    params: () => this.api.scope() ?? undefined,
    loader: ({ params }) => this.categoriesApi.list(params),
  });
  protected readonly categoryOptions = computed(() =>
    categoryRows(this.categories.hasValue() ? this.categories.value() : []),
  );
  protected readonly state = computed<RouteDrawerState>(() => {
    if (!this.api.scope() || !this.session.hasRole('OPERATOR')) {
      return 'error';
    }
    if (this.editing && !uuid.test(this.id() ?? '')) {
      return 'invalid-id';
    }
    if (this.record.isLoading()) {
      return 'loading';
    }
    if (this.record.error()) {
      return 'error';
    }
    return !this.editing || (this.record.hasValue() && this.record.value()) ? 'ready' : 'not-found';
  });
  protected readonly text = computed(() => operatorStrings[this.language.value()]);
  protected readonly shared = computed(() => uiMessages[this.language.value()]);
  protected readonly kinds = computed(() => [
    { value: 'TEXT', label: this.text().characteristicKindText },
    { value: 'SINGLE_CHOICE', label: this.text().characteristicKindSingle },
    { value: 'MULTIPLE_CHOICE', label: this.text().characteristicKindMultiple },
  ]);
  protected readonly subtitle = computed(() =>
    this.record.hasValue() ? (this.record.value()?.name ?? null) : null,
  );
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly errors = signal<Partial<Record<string, string>>>({});
  protected readonly characteristics = new FormArray<CharacteristicForm>([]);
  protected readonly form = new FormGroup({
    ...definitionFields(),
    categoryIds: new FormControl<string[]>([], { nonNullable: true }),
    characteristics: this.characteristics,
  });

  constructor() {
    effect(() => {
      this.api.scope();
      const group = this.record.hasValue() ? this.record.value() : null;
      this.characteristics.clear({ emitEvent: false });
      this.characteristics.push((group?.characteristics ?? []).map(characteristicForm), {
        emitEvent: false,
      });
      this.form.reset(
        {
          name: group?.name ?? '',
          sortOrder: group?.sortOrder ?? 0,
          active: group?.active ?? true,
          categoryIds: group?.categoryIds ?? [],
          characteristics: this.characteristics.getRawValue(),
        },
        { emitEvent: false },
      );
      this.errors.set({});
      this.saveError.set(false);
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        this.focusError();
      },
    );
  }

  protected selectPt(error: string | null, id: string, multiple = false) {
    return {
      label: {
        ...(multiple ? selectMultiplePt.label : {}),
        'aria-describedby': multiple ? id + '-hint ' + id + '-error' : id + '-error',
        'aria-invalid': error ? 'true' : undefined,
      },
    };
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  protected controlError(control: AbstractControl, path: string): string | null {
    return (
      this.errors()[path] ??
      (control.touched ? validationMessage(control.errors, this.language.value()) : null)
    );
  }

  protected clearError(path: string): void {
    this.errors.update((errors) => ({ ...errors, [path]: undefined }));
  }

  protected addCharacteristic(): void {
    this.characteristics.push(characteristicForm());
    this.characteristics.markAsDirty();
    this.focusControl(`characteristic-group-name-${String(this.characteristics.length - 1)}`);
  }

  protected removeCharacteristic(index: number): void {
    if (this.characteristics.at(index).controls.id.value) {
      return;
    }
    this.characteristics.removeAt(index);
    this.characteristics.markAsDirty();
    this.clearCharacteristicErrors();
    this.focusControl('characteristic-group-add');
  }

  protected changeKind(item: CharacteristicForm, index: number): void {
    if (item.controls.kind.value === 'TEXT') {
      item.controls.choices.clear();
    }
    this.clearError(`characteristics.${String(index)}.kind`);
  }

  protected addChoice(item: CharacteristicForm, index: number): void {
    const choices = item.controls.choices;
    choices.push(choiceForm());
    choices.markAsDirty();
    this.focusControl(`characteristic-group-choice-${String(index)}-${String(choices.length - 1)}`);
  }

  protected removeChoice(item: CharacteristicForm, index: number, choiceIndex: number): void {
    const choices = item.controls.choices;
    if (choices.at(choiceIndex).controls.id.value) {
      return;
    }
    choices.removeAt(choiceIndex);
    choices.markAsDirty();
    this.clearCharacteristicErrors();
    this.focusControl(`characteristic-group-choice-add-${String(index)}`);
  }

  private clearCharacteristicErrors(): void {
    this.errors.update(({ name, sortOrder, categoryIds }) => ({ name, sortOrder, categoryIds }));
  }

  protected async save(): Promise<void> {
    const scope = this.api.scope();
    if (!scope || this.saving() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    this.errors.set({});
    this.saveError.set(false);
    if (this.form.invalid) {
      afterNextRender(
        () => {
          this.focusError();
        },
        { injector: this.injector },
      );
      return;
    }
    const { characteristics, sortOrder, categoryIds, ...draft } = this.form.getRawValue();
    this.saving.set(true);
    try {
      const id = await this.api.save(
        scope,
        {
          ...draft,
          sortOrder: sortOrder ?? 0,
          ...(this.form.controls.categoryIds.dirty ? { categoryIds } : {}),
          characteristics: characteristics.map(({ id, sortOrder, choices, ...item }) => ({
            ...item,
            ...(id ? { id } : {}),
            sortOrder: sortOrder ?? 0,
            ...(item.kind === 'TEXT' ? {} : { choices }),
          })),
        },
        this.id(),
      );
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      this.form.markAsPristine();
      this.saving.set(false);
      this.host.saved({ message: this.text().characteristicGroupSaved, recordId: id });
      this.drawer().close();
    } catch (error: unknown) {
      if (this.destroyRef.destroyed || this.api.scope() !== scope) {
        return;
      }
      const fields = [
        'name',
        'sortOrder',
        'categoryIds',
        ...characteristics.flatMap(({ choices }, index) => {
          const path = `characteristics.${String(index)}`;
          return [
            ...['id', 'name', 'sortOrder', 'kind', 'choices'].map((field) => `${path}.${field}`),
            ...choices.flatMap((_, choiceIndex) =>
              ['id', 'name'].map((field) => `${path}.choices.${String(choiceIndex)}.${field}`),
            ),
          ];
        }),
      ];
      const errors = fieldErrors(error, fields, scope.language, (code, path) => {
        if (path === 'categoryIds') {
          return this.text().categoryUnavailable;
        }
        if (path.includes('.choices.')) {
          if (path.endsWith('.id')) {
            return this.text().characteristicChoiceUnavailable;
          }
          if (code === 'DUPLICATE_VALUE') {
            return this.text().characteristicChoiceDuplicate;
          }
        }
        if (path.endsWith('.id')) {
          return this.text().characteristicUnavailable;
        }
        if (code === 'DUPLICATE_VALUE' && path.startsWith('characteristics.')) {
          return this.text().characteristicDuplicate;
        }
        return undefined;
      });
      this.errors.set(errors);
      this.saveError.set(!Object.keys(errors).length);
    } finally {
      this.saving.set(false);
    }
  }

  private focusControl(id: string): void {
    afterNextRender(
      () => {
        this.formElement()?.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
      },
      { injector: this.injector },
    );
  }

  private focusError(): void {
    const form = this.formElement()?.nativeElement;
    const order = [
      'name',
      'categories',
      'sort-order',
      ...this.characteristics.controls.flatMap(({ controls: { choices } }, index) => [
        `name-${String(index)}`,
        `sort-order-${String(index)}`,
        `kind-${String(index)}`,
        ...choices.controls.map(
          (_, choiceIndex) => `choice-${String(index)}-${String(choiceIndex)}`,
        ),
      ]),
    ];
    if (!form || !focusFirstInvalid(form, order, 'characteristic-group-')) {
      this.drawer().focusTitle();
    }
  }
}
