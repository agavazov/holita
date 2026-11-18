import bg from './bg.json';
import en from './en.json';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import type { Language } from '../../i18n/messages';
import { FormField } from '../form-field/form-field';
import { MenuButton, type MenuOption } from '../menu-button/menu-button';
import { ThemeMenu } from '../theme-menu/theme-menu';

/** A credential screen; the application owns authentication and navigation. */
@Component({
  selector: 'osnova-sign-in',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    Message,
    FormField,
    MenuButton,
    ThemeMenu,
  ],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn {
  readonly productName = input.required<string>();
  readonly productMark = input.required<string>();
  readonly language = input.required<Language>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly languageChange = output<Language>();
  readonly submitCredentials = output<{ email: string; password: string }>();
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        (control) => Validators.email(control),
        Validators.maxLength(254),
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [(control) => Validators.required(control)],
    }),
  });
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly languages = computed<readonly MenuOption[]>(() => [
    { id: 'bg', label: 'Български', lang: 'bg', selected: this.language() === 'bg' },
    { id: 'en', label: 'English', lang: 'en', selected: this.language() === 'en' },
  ]);
  protected chooseLanguage(value: string): void {
    if (value === 'bg' || value === 'en') {
      this.languageChange.emit(value);
    }
  }
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.valid && !this.busy()) {
      this.submitCredentials.emit(this.form.getRawValue());
    }
  }
}
