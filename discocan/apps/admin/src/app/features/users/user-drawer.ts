import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import type { AdminUserDetailsFragment, UserRole } from '../../../generated/graphql/operations';
import { RouteDrawer, type RouteDrawerState } from '../../ui/drawer/route-drawer';
import { FormField } from '../../ui/form-field/form-field';
import { focusFirstInvalid } from '../../ui/forms/focus';
import { lockWhileSaving } from '../../ui/forms/saving';
import { textValidator, validationMessage } from '../../ui/forms/validators';
import { interpolate } from '../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { usersText } from './i18n/messages';

export interface UserForm {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: UserRole;
}

export type UserField = keyof UserForm;
const fieldOrder: readonly UserField[] = ['name', 'email', 'role', 'password'];
const initialPassword: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value.length === 0) {
    return { required: true };
  }
  const length = Array.from(value).length;
  return length < 12 || length > 128 || value.includes('\u0000') ? { passwordLength: true } : null;
};

@Component({
  selector: 'discocan-user-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    InputText,
    Message,
    Select,
    RouteDrawer,
    FormField,
  ],
  templateUrl: './user-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDrawer {
  readonly user = input<AdminUserDetailsFragment | null>(null);
  readonly creating = input(false);
  readonly canManage = input(false);
  readonly ownAccount = input(false);
  readonly saving = input(false);
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly saveError = input<string | null>(null);
  readonly closeLink = input.required<readonly unknown[]>();
  readonly fieldErrors = input<Partial<Record<UserField, string>>>({});
  readonly save = output<UserForm>();
  readonly retry = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly formElement = viewChild<ElementRef<HTMLFormElement>>('formElement');
  protected readonly text = computed(() => usersText(this.language()));
  protected readonly roleOptions = computed(() =>
    Object.entries(this.text().roles).map(([value, label]) => ({ value, label })),
  );
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: textValidator(200, { required: true }),
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [textValidator(254, { required: true }), (control) => Validators.email(control)],
    }),
    role: new FormControl<UserRole>('VIEWER', {
      nonNullable: true,
      validators: (control) => Validators.required(control),
    }),
    password: new FormControl('', { nonNullable: true }),
  });
  private readonly events = toSignal(this.form.events);
  private submitted = false;
  protected readonly dirty = computed(() => {
    this.events();
    return this.form.dirty;
  });
  protected readonly title = computed(() => {
    const user = this.user();
    const text = this.text().drawer;
    return this.creating()
      ? text.createTitle
      : user
        ? interpolate(text.editTitle, { name: user.name })
        : text.editFallback;
  });

  constructor() {
    effect(() => {
      const user = this.user();
      const creating = this.creating();
      untracked(() => {
        this.submitted = false;
        this.form.controls.password.setValidators(creating ? initialPassword : null);
        this.form.reset({
          name: user?.name ?? '',
          email: user?.email ?? '',
          role: user?.role ?? 'VIEWER',
          password: '',
        });
      });
    });
    effect(() => {
      if (this.state() !== 'ready' || !Object.keys(this.fieldErrors()).length) {
        return;
      }
      this.focusInvalid();
    });
    effect(() => {
      if (this.saveError() && !Object.keys(this.fieldErrors()).length) {
        afterNextRender(
          () => {
            this.drawer().focusTitle();
          },
          { injector: this.injector },
        );
      }
    });
    lockWhileSaving(
      this.form,
      () => this.saving(),
      () => {
        const form = this.formElement()?.nativeElement;
        if (!form || !focusFirstInvalid(form, fieldOrder, 'user-')) {
          this.drawer().keepFocusInside();
        }
      },
    );
  }

  protected errorOf(field: UserField): string | null {
    this.events();
    const server = this.fieldErrors()[field];
    if (server) {
      return server;
    }
    const control = this.form.controls[field];
    if (!control.invalid || (!control.touched && !this.submitted)) {
      return null;
    }
    return control.hasError('passwordLength')
      ? this.text().drawer.passwordLength
      : validationMessage(control.errors, this.language());
  }

  protected submit(): void {
    if (this.saving() || this.state() !== 'ready' || !this.canManage()) {
      return;
    }
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.focusInvalid();
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({ ...value, name: value.name.trim(), email: value.email.trim() });
  }

  protected close(): void {
    this.drawer().close();
  }

  markSaved(): void {
    this.form.controls.password.reset('');
    this.form.markAsPristine();
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.saving() && this.drawer().confirmLeave(this.form.dirty);
  }

  private focusInvalid(): void {
    afterNextRender(
      () => {
        const form = this.formElement()?.nativeElement;
        if (this.state() === 'ready' && form?.isConnected) {
          focusFirstInvalid(form, fieldOrder, 'user-');
        }
      },
      { injector: this.injector },
    );
  }
}
