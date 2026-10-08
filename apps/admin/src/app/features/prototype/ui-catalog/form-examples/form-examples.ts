import { Component, computed, type ElementRef, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Select } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { RadioButton } from 'primeng/radiobutton';
import { Checkbox } from 'primeng/checkbox';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { messages, type Language } from '../../../../i18n/messages';

@Component({
  selector: 'holita-form-examples',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Select,
    DatePicker,
    RadioButton,
    Checkbox,
    ToggleSwitch,
    InputText,
    Textarea,
    ButtonDirective,
    Message,
    Tag,
  ],
  templateUrl: './form-examples.html',
  styleUrl: '../catalog-examples.scss',
})
export class FormExamples {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly state = signal<'ready' | 'saving' | 'error' | 'disabled'>('ready');
  readonly notice = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        Validators.pattern(/\S/),
        Validators.maxLength(200),
      ],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        (control) => Validators.email(control),
      ],
    }),
    quantity: new FormControl<number | null>(1, [
      (control) => Validators.required(control),
      Validators.min(1),
      Validators.max(Number.MAX_SAFE_INTEGER),
      Validators.pattern(/^\d+$/),
    ]),
    category: new FormControl('accessories', { nonNullable: true }),
    labels: new FormControl<string[]>([], { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    date: new FormControl<Date | null>(null),
    dateTime: new FormControl<Date | null>(null),
    color: new FormControl('#22c55e', { nonNullable: true }),
    delivery: new FormControl('pickup', { nonNullable: true }),
    notify: new FormControl(false, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });
  private readonly changes = toSignal(this.form.valueChanges);
  readonly summary = computed(() => {
    this.changes();
    return this.form.getRawValue();
  });
  readonly stateOptions = computed(() => [
    { value: 'ready', label: this.text().catalogReady },
    { value: 'saving', label: this.text().catalogSaving },
    { value: 'error', label: this.text().catalogSaveError },
    { value: 'disabled', label: this.text().catalogDisabled },
  ]);
  readonly categoryOptions = computed(() => [
    { value: 'accessories', label: this.text().catalogAccessories },
    { value: 'home', label: this.text().catalogHome },
    { value: 'office', label: this.text().catalogOffice },
  ]);
  readonly labelOptions = computed(() => [
    { value: 'featured', label: this.text().catalogFeatured },
    { value: 'new', label: this.text().catalogNew },
    { value: 'seasonal', label: this.text().catalogSeasonal },
  ]);
  readonly disabled = computed(() => this.state() === 'saving' || this.state() === 'disabled');
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');
  private readonly emailInput = viewChild.required<ElementRef<HTMLInputElement>>('emailInput');
  private readonly quantityInput =
    viewChild.required<ElementRef<HTMLInputElement>>('quantityInput');

  changeState(value: unknown): void {
    if (value !== 'ready' && value !== 'saving' && value !== 'error' && value !== 'disabled')
      return;
    this.state.set(value);
    this.notice.set(false);
    if (this.disabled()) this.form.disable();
    else this.form.enable();
  }
  invalid(field: 'name' | 'email' | 'quantity'): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }
  nameError(): string {
    return this.form.controls.name.hasError('maxlength')
      ? this.text().catalogNameTooLong
      : this.text().nameRequired;
  }
  save(): void {
    if (this.disabled()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const field = this.form.controls.name.invalid
        ? this.nameInput()
        : this.form.controls.email.invalid
          ? this.emailInput()
          : this.quantityInput();
      field.nativeElement.focus();
      return;
    }
    this.state.set('ready');
    this.notice.set(true);
  }
  reset(): void {
    this.changeState('ready');
    this.form.reset({ quantity: 1 });
  }
}
