import { DefaultUrlSerializer } from '@angular/router';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { loginFixtures } from '../../../storybook/login-fixtures';
import { storyLanguage, type StoryFixtures } from '../../../storybook/story-config';
import { Login } from './login';

const meta: Meta<Login> = {
  title: 'Admin/Sign in',
  component: Login,
  tags: ['!autodocs'],
  render: (_args, context) => {
    const language = storyLanguage(context.globals);
    return { props: { language, languageUrl: new DefaultUrlSerializer().parse(`/${language}`) } };
  },
  parameters: { holita: { signedIn: false } satisfies StoryFixtures },
  beforeEach: () => loginFixtures(),
};

export default meta;
type Story = StoryObj<Login>;

export const Default: Story = {};

export const Loading: Story = {
  parameters: {
    holita: {
      signedIn: false,
      scenario: { failures: { AdminTenants: 'pending' } },
    } satisfies StoryFixtures,
  },
};

export const Empty: Story = {
  beforeEach: () => loginFixtures({ emptyTenants: true }),
};

const tenantFailure = {
  holita: {
    signedIn: false,
    scenario: { failures: { AdminTenants: 'network' } },
  } satisfies StoryFixtures,
};

export const ErrorState: Story = {
  name: 'Error',
  parameters: tenantFailure,
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
