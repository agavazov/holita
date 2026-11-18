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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import type {
  AdminChangePasswordMutationVariables,
  AdminProfileQuery,
  AdminUpdateProfileMutationVariables,
} from '../../../generated/graphql/operations';
import { confirmDialogPt, confirmDiscard } from '../../ui/confirm';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { FormField } from '../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../ui/forms/focus';
import { textValidator, validationMessage } from '../../ui/forms/validators';
import { PageHeader } from '../../ui/page-header/page-header';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { profileText } from './i18n/messages';

export type ProfileField = 'name' | 'email';
export type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';
const identityFields: readonly ProfileField[] = ['name', 'email'];
const passwordFields: readonly PasswordField[] = [
  'currentPassword',
  'newPassword',
  'confirmPassword',
];

@Component({
  selector: 'discocan-profile-view',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    Message,
    EmptyState,
    FormField,
    PageHeader,
  ],
  providers: [ConfirmationService],
  templateUrl: './profile-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class ProfileView {
  readonly user = input<AdminProfileQuery['me'] | null>(null);
  readonly state = input<'loading' | 'error' | 'ready'>('ready');
  readonly loadError = input<string | null>(null);
  readonly saving = input(false);
  readonly changingPassword = input(false);
  readonly saved = input(false);
  readonly saveError = input<string | null>(null);
  readonly passwordError = input<string | null>(null);
  readonly fieldErrors = input<Partial<Record<ProfileField, string>>>({});
  readonly passwordFieldErrors = input<Partial<Record<PasswordField, string>>>({});
  readonly save = output<AdminUpdateProfileMutationVariables>();
  readonly passwordChange = output<AdminChangePasswordMutationVariables>();
  readonly discarded = output();
  readonly retry = output();
  private readonly language = inject(UI_LANGUAGE);
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly identityElement = viewChild<ElementRef<HTMLFormElement>>('identityElement');
  private readonly passwordElement = viewChild<ElementRef<HTMLFormElement>>('passwordElement');
  private readonly header = viewChild.required(PageHeader);
  protected readonly text = computed(() => profileText(this.language()));
  protected readonly confirmPt = computed(() => confirmDialogPt(this.language()));
  protected readonly busy = computed(() => this.saving() || this.changingPassword());
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: textValidator(200, { required: true }),
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(254, { required: true }), (control) => Validators.email(control)],
    }),
  });
  protected readonly passwords = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
  });
  private readonly formEvents = toSignal(this.form.events);
  private readonly passwordEvents = toSignal(this.passwords.events);
  private pendingLeave: Promise<boolean> | null = null;
  protected readonly dirty = computed(() => {
    this.formEvents();
    this.passwordEvents();
    return this.form.dirty || this.passwords.dirty;
  });

  constructor() {
    effect(() => {
      const user = this.user();
      if (user) {
        untracked(() => {
          this.form.reset({ name: user.name, email: user.email });
        });
      }
    });
    effect(() => {
      const locked = this.busy() || this.state() !== 'ready';
      untracked(() => {
        if (locked) {
          this.form.disable();
          this.passwords.disable();
        } else {
          this.form.enable();
          this.passwords.enable();
        }
      });
    });
    effect(() => {
      const hasIdentityErrors = Object.keys(this.fieldErrors()).length > 0;
      const hasPasswordErrors = Object.keys(this.passwordFieldErrors()).length > 0;
      if (hasIdentityErrors || hasPasswordErrors) {
        afterNextRender(
          () => {
            this.focusInvalid(hasPasswordErrors ? 'password' : 'identity');
          },
          { injector: this.injector },
        );
      }
    });
  }

  protected errorOf(name: ProfileField): string | null {
    this.formEvents();
    const control = this.form.controls[name];
    return (
      this.fieldErrors()[name] ??
      (control.touched && control.invalid
        ? control.hasError('email')
          ? this.text().invalidEmail
          : validationMessage(control.errors, this.language())
        : null)
    );
  }

  protected passwordErrorOf(name: PasswordField): string | null {
    this.passwordEvents();
    const control = this.passwords.controls[name];
    const server = this.passwordFieldErrors()[name];
    if (server) {
      return server;
    }
    if (!control.touched) {
      return null;
    }
    if (control.invalid) {
      return validationMessage(control.errors, this.language());
    }
    if (name === 'newPassword') {
      const value = control.value;
      const length = Array.from(value).length;
      if (length < 12 || length > 128 || value.includes('\u0000')) {
        return this.text().passwordRequirements;
      }
    }
    if (name === 'confirmPassword' && control.value !== this.passwords.controls.newPassword.value) {
      return this.text().passwordMismatch;
    }
    return null;
  }

  protected submitIdentity(): void {
    if (this.busy() || this.state() !== 'ready') {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.scheduleFocus('identity');
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({ name: value.name.trim(), email: value.email.trim() });
  }

  protected async submitPassword(): Promise<void> {
    if (this.busy() || this.state() !== 'ready') {
      return;
    }
    this.passwords.markAllAsTouched();
    const value = this.passwords.getRawValue();
    const length = Array.from(value.newPassword).length;
    if (
      this.passwords.invalid ||
      length < 12 ||
      length > 128 ||
      value.newPassword.includes('\u0000') ||
      value.newPassword !== value.confirmPassword
    ) {
      this.scheduleFocus('password');
      return;
    }
    if (this.form.dirty) {
      if (!(await confirmDiscard(this.confirmation, this.language()))) {
        return;
      }
      const user = this.user();
      if (user) {
        this.form.reset({ name: user.name, email: user.email });
      }
    }
    this.passwordChange.emit({
      currentPassword: value.currentPassword,
      newPassword: value.newPassword,
    });
  }

  protected discard(): void {
    const user = this.user();
    if (!user || this.busy()) {
      return;
    }
    this.form.reset({ name: user.name, email: user.email });
    this.passwords.reset();
    this.discarded.emit();
    this.header().focusTitle();
  }

  passwordChanged(): void {
    this.passwords.reset();
  }

  canLeave(): boolean | Promise<boolean> {
    if (this.busy()) {
      return false;
    }
    if (!this.form.dirty && !this.passwords.dirty) {
      return true;
    }
    this.pendingLeave ??= confirmDiscard(this.confirmation, this.language()).finally(() => {
      this.pendingLeave = null;
    });
    return this.pendingLeave;
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.busy()) {
      event.preventDefault();
    }
  }

  private scheduleFocus(section: 'identity' | 'password'): void {
    afterNextRender(
      () => {
        this.focusInvalid(section);
      },
      { injector: this.injector },
    );
  }

  private focusInvalid(section: 'identity' | 'password'): void {
    const element = section === 'identity' ? this.identityElement() : this.passwordElement();
    if (element) {
      focusFirstInvalid(
        element.nativeElement,
        section === 'identity' ? identityFields : passwordFields,
        'profile-',
      );
    }
  }
}
