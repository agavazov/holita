import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { loginFixtures } from '../../../storybook/login-fixtures';
import {
  fixtureAccount,
  fixtureBranches,
  fixtureTenant,
  fixtureToken,
} from '../../../storybook/session-fixtures';
import {
  routeAt,
  StoryApp,
  storyLanguage,
  type StoryFixtures,
} from '../../../storybook/story-config';
import { DemoSession } from '../../core/auth/demo-session';
import type { Language } from '../../i18n/messages';
import { Login } from './login';

type LoginState =
  'default' | 'submitting' | 'credentials' | 'branches' | 'loading' | 'empty' | 'error' | 'expired';

/** State snapshots use the real sign-in presentation and the same transport fixtures. */
@Component({
  selector: 'holita-login-story',
  imports: [Login],
  template: '<holita-login [language]="language()" [languageUrl]="languageUrl" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class LoginStory {
  readonly language = input.required<Language>();
  readonly state = input<LoginState>('default');
  readonly languageUrl = inject(Router).createUrlTree(['/en/sign-in']);
  private readonly login = viewChild.required(Login);
  private readonly session = inject(DemoSession);
  constructor() {
    afterNextRender(() => {
      const view = this.login();
      const state = this.state();
      if (state === 'submitting') {
        view.busy.set(true);
        view.form.disable();
      } else if (state === 'credentials') {
        view.failure.set('credentials');
      } else if (state === 'expired') {
        this.session.notice.set('expired');
      } else if (state !== 'default') {
        view.prepared.set({
          token: fixtureToken,
          tenant: fixtureTenant,
          user: fixtureAccount,
          expiresAt: '2100-01-01T00:00:00.000Z',
        });
        view.branches.set(
          state === 'empty' || state === 'loading' || state === 'error' ? [] : [...fixtureBranches],
        );
        view.branchesLoading.set(state === 'loading');
        if (state === 'error') {
          view.failure.set('branches');
        }
      }
    });
  }
}

const meta: Meta = {
  title: 'Admin/Sign in',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: false } satisfies StoryFixtures },
  beforeEach: () => loginFixtures(),
};
export default meta;
type Story = StoryObj;

function snapshot(state: LoginState): NonNullable<Story['render']> {
  return (_args, context) => ({
    props: { language: storyLanguage(context.globals), state },
    moduleMetadata: { imports: [LoginStory] },
    template: '<holita-login-story [language]="language" [state]="state" />',
  });
}

export const Default: Story = {
  render: () => ({
    ...routeAt('sign-in')(),
    moduleMetadata: { imports: [StoryApp] },
    template: '<holita-story-app [url]="url" />',
  }),
};
export const SigningIn: Story = { render: snapshot('submitting') };
export const InvalidCredentials: Story = { render: snapshot('credentials') };
export const ChooseFleet: Story = { render: snapshot('branches') };
export const LoadingFleets: Story = { render: snapshot('loading') };
export const NoFleets: Story = { render: snapshot('empty') };
export const FleetError: Story = { render: snapshot('error') };
export const ExpiredSession: Story = { render: snapshot('expired') };
