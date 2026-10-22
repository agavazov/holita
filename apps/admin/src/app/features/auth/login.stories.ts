import { DefaultUrlSerializer } from '@angular/router';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useFixtureScenario } from '../../../storybook/graphql-fixtures';
import { loginFixtures, loginTenants } from '../../../storybook/login-fixtures';
import { fixtureBranches } from '../../../storybook/session-fixtures';
import type { StoryFixtures } from '../../../storybook/story-config';
import { Login } from './login';

const appReady = { timeout: 10_000 };

const meta: Meta<Login> = {
  title: 'Admin/Authentication/Login',
  component: Login,
  tags: ['!autodocs'],
  // Storybook keeps one language, so the language link stays on English.
  render: () => ({
    props: { language: 'en', languageUrl: new DefaultUrlSerializer().parse('/en') },
  }),
  parameters: { holita: { signedIn: false } satisfies StoryFixtures },
  beforeEach: () => loginFixtures(),
};

export default meta;
type Story = StoryObj<Login>;

async function loginReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () => expect(canvas.getByRole('heading', { level: 1, name: 'Demo sign in' })).toBeVisible(),
    appReady,
  );
  return canvas;
}

async function choose(canvasElement: HTMLElement, field: string, option: string): Promise<void> {
  await userEvent.click(within(canvasElement).getByRole('combobox', { name: field }));
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(await body.findByRole('option', { name: option }, appReady));
}

async function chooseTenant(canvasElement: HTMLElement): Promise<void> {
  await loginReady(canvasElement);
  await choose(canvasElement, 'Tenant', loginTenants[0].name);
}

const initialState: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const canvas = await loginReady(canvasElement);
  await expect(canvas.getByRole('combobox', { name: 'Branch' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeDisabled();
};

export const Default: Story = { play: initialState };

export const TenantChange: Story = {
  name: 'Changing the tenant clears the branch',
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await chooseTenant(canvasElement);
    const branch = canvas.getByRole('combobox', { name: 'Branch' });
    await waitFor(() => expect(branch).not.toHaveAttribute('aria-disabled', 'true'), appReady);
    await choose(canvasElement, 'Branch', fixtureBranches[0].name);
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await choose(canvasElement, 'Tenant', loginTenants[1].name);
    await waitFor(() => expect(branch).toHaveTextContent('Choose a branch'), appReady);
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  },
};

export const Loading: Story = {
  parameters: {
    holita: {
      signedIn: false,
      scenario: { failures: { AdminTenants: 'pending' } },
    } satisfies StoryFixtures,
  },
  play: initialState,
};

export const BranchLoading: Story = {
  name: 'Branch discovery loading',
  parameters: {
    holita: {
      signedIn: false,
      scenario: { failures: { AdminBranches: 'pending' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await chooseTenant(canvasElement);
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Loading branches…'));
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  },
};

export const Empty: Story = {
  beforeEach: () => loginFixtures({ emptyTenants: true }),
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await waitFor(() => expect(canvas.getByText('No tenants available.')).toBeVisible(), appReady);
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  },
};

export const EmptyBranches: Story = {
  name: 'No branches',
  beforeEach: () => loginFixtures({ emptyBranches: true }),
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await chooseTenant(canvasElement);
    await waitFor(() => expect(canvas.getByText('No branches available.')).toBeVisible(), appReady);
    await expect(canvas.getByRole('combobox', { name: 'Branch' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  },
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
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible(), appReady);
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeVisible();
  },
};

export const Retry: Story = {
  parameters: tenantFailure,
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible(), appReady);
    useFixtureScenario(undefined);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await chooseTenant(canvasElement);
    await waitFor(
      () =>
        expect(canvas.getByRole('combobox', { name: 'Branch' })).not.toHaveAttribute(
          'aria-disabled',
          'true',
        ),
      appReady,
    );
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull(), appReady);
  },
};

export const BranchError: Story = {
  name: 'Branch discovery error and retry',
  parameters: {
    holita: {
      signedIn: false,
      scenario: { failures: { AdminBranches: 'network' } },
    } satisfies StoryFixtures,
  },
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await chooseTenant(canvasElement);
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible(), appReady);
    useFixtureScenario(undefined);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await waitFor(
      () =>
        expect(canvas.getByRole('combobox', { name: 'Branch' })).not.toHaveAttribute(
          'aria-disabled',
          'true',
        ),
      appReady,
    );
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull(), appReady);
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  },
};

export const SessionError: Story = {
  ...BranchError,
  name: 'Tenant session error and retry',
  parameters: {
    holita: {
      signedIn: false,
      scenario: { failures: { AdminDemoLogin: 'network' } },
    } satisfies StoryFixtures,
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: initialState,
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: initialState,
};
