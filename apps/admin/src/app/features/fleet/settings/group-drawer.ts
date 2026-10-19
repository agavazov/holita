import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../../ui/forms/focus';
import { lockWhileSaving } from '../../../ui/forms/saving';
import { textValidator, validationMessage } from '../../../ui/forms/validators';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { settingsText } from './i18n/messages';

/** The categorical colour slots a group can take (the design system's category palette). */
export const groupSlots = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as const;

export interface GroupForm {
  readonly name: string;
  readonly slot: string;
  readonly description: string;
}

export type GroupField = keyof GroupForm;
const fieldOrder: readonly GroupField[] = ['name', 'description'];

/** Create or edit a vehicle group in the right-hand drawer (a small form, `md` size). */
@Component({
  selector: 'holita-group-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    Select,
    Textarea,
    RouteDrawer,
    FormField,
  ],
  templateUrl: './group-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDrawer {
  readonly group = input<GroupForm | null>(null);
  readonly saving = input(false);
  readonly fieldErrors = input<Partial<Record<GroupField, string>>>({});
  readonly save = output<GroupForm>();
  readonly closed = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild.required<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => settingsText(this.language()).groups.drawer);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: textValidator(40, { required: true }),
    }),
    slot: new FormControl<string>('c1', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true, validators: textValidator(200) }),
  });
  private readonly events = toSignal(this.form.events);
  private submitted = false;

  protected readonly title = computed(() => {
    const group = this.group();
    return group
      ? interpolate(this.text().editTitle, { name: group.name })
      : this.text().createTitle;
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  protected readonly slotOptions = computed(() =>
    groupSlots.map((slot, index) => ({
      value: slot,
      label: interpolate(this.text().colorOption, { number: index + 1 }),
    })),
  );

  constructor() {
    effect(() => {
      const group = this.group();
      untracked(() => {
        this.submitted = false;
        this.form.reset({
          name: group?.name ?? '',
          slot: group?.slot ?? 'c1',
          description: group?.description ?? '',
        });
      });
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        if (!focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'group-'))
          this.drawer().keepFocusInside();
      },
    );
  }

  protected errorOf(name: GroupField): string | null {
    this.events();
    const server = this.fieldErrors()[name];
    if (server) return server;
    const control = this.form.controls[name];
    if (!control.invalid || (!control.touched && !this.submitted)) return null;
    return validationMessage(control.errors, this.language());
  }

  protected submit(): void {
    if (this.saving()) return;
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      afterNextRender(
        () => {
          focusFirstInvalid(this.formElement().nativeElement, fieldOrder, 'group-');
        },
        { injector: this.injector },
      );
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({ ...value, name: value.name.trim(), description: value.description.trim() });
  }

  protected async requestClose(): Promise<void> {
    if (await this.canLeave()) this.closed.emit();
  }

  canLeave(): boolean | Promise<boolean> {
    return this.saving() ? false : this.drawer().confirmLeave(this.form.dirty);
  }
}
