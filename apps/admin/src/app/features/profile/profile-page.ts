import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import type {
  AdminChangePasswordMutationVariables,
  AdminProfileQuery,
  AdminUpdateProfileMutationVariables,
} from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import type { Language } from '../../i18n/messages';
import { errorCode, fieldErrors } from '../../ui/forms/field-errors';
import { UI_LANGUAGE } from '../../ui/ui-language';
import { profileText } from './i18n/messages';
import { ProfileApi } from './profile-api';
import { ProfileView, type PasswordField, type ProfileField } from './profile-view';

@Component({
  selector: 'discocan-profile-workspace',
  imports: [ProfileView],
  providers: [ProfileApi],
  template: `
    <discocan-profile-view
      [user]="user()"
      [state]="loading() ? 'loading' : loadError() ? 'error' : 'ready'"
      [loadError]="loadFailure()"
      [saving]="saving()"
      [changingPassword]="changingPassword()"
      [saved]="saved()"
      [saveError]="saveFailure()"
      [passwordError]="passwordFailure()"
      [fieldErrors]="identityErrors()"
      [passwordFieldErrors]="passwordErrors()"
      (save)="save($event)"
      (passwordChange)="changePassword($event)"
      (discarded)="discard()"
      (retry)="load()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileWorkspace implements OnInit {
  readonly language = input.required<Language>();
  readonly token = input.required<string>();
  private readonly session = inject(DemoSession);
  private readonly uiLanguage = inject(UI_LANGUAGE);
  private readonly api = inject(ProfileApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly view = viewChild.required(ProfileView);
  private readonly text = computed(() => profileText(this.language()));
  protected readonly user = signal<AdminProfileQuery['me'] | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<unknown>(null);
  protected readonly saveError = signal<unknown>(null);
  protected readonly passwordError = signal<unknown>(null);
  protected readonly saving = signal(false);
  protected readonly changingPassword = signal(false);
  protected readonly saved = signal(false);
  protected readonly loadFailure = computed(() =>
    this.loadError() ? this.text().loadError : null,
  );
  protected readonly saveFailure = computed(() =>
    this.saveError() ? this.text().saveError : null,
  );
  protected readonly passwordFailure = computed(() =>
    this.passwordError() ? this.text().passwordError : null,
  );
  protected readonly identityErrors = computed(() =>
    fieldErrors<ProfileField>(this.saveError(), ['name', 'email'], this.language(), (code) =>
      code === 'DUPLICATE' ? this.text().duplicateEmail : undefined,
    ),
  );
  protected readonly passwordErrors = computed(() =>
    fieldErrors<PasswordField>(
      this.passwordError(),
      ['currentPassword', 'newPassword'],
      this.language(),
      (code, path) =>
        code === 'INVALID_PASSWORD'
          ? this.text().incorrectPassword
          : path === 'newPassword' && code === 'INVALID_FORMAT'
            ? this.text().passwordRequirements
            : undefined,
    ),
  );

  ngOnInit(): void {
    this.api.initialize(this.language());
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const user = await this.api.load();
      if (this.current()) {
        this.user.set(user);
        this.session.updateUser(user);
      }
    } catch (error: unknown) {
      if (this.current()) {
        this.loadError.set(error);
        this.expireIfNeeded(error);
      }
    } finally {
      if (this.current()) {
        this.loading.set(false);
      }
    }
  }

  protected async save(variables: AdminUpdateProfileMutationVariables): Promise<void> {
    if (this.saving() || this.changingPassword()) {
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);
    try {
      const user = await this.api.update(variables);
      if (this.current()) {
        this.user.set(user);
        this.session.updateUser(user);
        this.saved.set(true);
      }
    } catch (error: unknown) {
      if (this.current()) {
        this.saveError.set(error);
        this.expireIfNeeded(error);
      }
    } finally {
      if (this.current()) {
        this.saving.set(false);
      }
    }
  }

  protected async changePassword(variables: AdminChangePasswordMutationVariables): Promise<void> {
    if (this.saving() || this.changingPassword()) {
      return;
    }
    this.changingPassword.set(true);
    this.passwordError.set(null);
    try {
      await this.api.changePassword(variables);
      if (this.current()) {
        this.view().passwordChanged();
        this.changingPassword.set(false);
        this.session.end('passwordChanged');
      }
    } catch (error: unknown) {
      if (this.current()) {
        this.passwordError.set(error);
        this.expireIfNeeded(error);
      }
    } finally {
      if (this.current()) {
        this.changingPassword.set(false);
      }
    }
  }

  protected discard(): void {
    this.saved.set(false);
    this.saveError.set(null);
    this.passwordError.set(null);
  }

  canLeave(): boolean | Promise<boolean> {
    return this.view().canLeave();
  }

  private current(): boolean {
    return (
      !this.destroyRef.destroyed &&
      this.session.current()?.token === this.token() &&
      this.uiLanguage() === this.language()
    );
  }

  private expireIfNeeded(error: unknown): void {
    if (errorCode(error) === 'UNAUTHENTICATED') {
      this.session.expire(this.token());
    }
  }
}

@Component({
  selector: 'discocan-profile-page',
  imports: [ProfileWorkspace],
  template: `
    @for (scope of scopes(); track scope.key) {
      <discocan-profile-workspace [language]="scope.language" [token]="scope.token" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly session = inject(DemoSession);
  private readonly language = inject(UI_LANGUAGE);
  private readonly workspace = viewChild(ProfileWorkspace);
  protected readonly scopes = computed(() => {
    const token = this.session.current()?.token;
    const language = this.language();
    return token ? [{ token, language, key: `${token}:${language}` }] : [];
  });

  canLeave(): boolean | Promise<boolean> {
    return this.workspace()?.canLeave() ?? true;
  }
}
