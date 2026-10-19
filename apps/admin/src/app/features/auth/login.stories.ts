import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../storybook/interactions';
import { useFixtureScenario } from '../../../storybook/graphql-fixtures';
import { loginFixtures, loginTenants } from '../../../storybook/login-fixtures';
import { LoginPage } from '../../../storybook/samples/pages/login-page';
import { fixtureBranches } from '../../../storybook/session-fixtures';
import type { StoryFixtures } from '../../../storybook/story-config';

const appReady = { timeout: 10_000 };

const meta: Meta<LoginPage> = {
  title: 'Examples/Authentication/Login',
  component: LoginPage,
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: false } satisfies StoryFixtures },
  beforeEach: () => loginFixtures(),
};

export default meta;
type Story = StoryObj<LoginPage>;

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

/** The real Login completes discovery; the story host opens the existing sample Vehicles. */
export const SignIn: Story = {
  name: 'Sign in',
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await chooseTenant(canvasElement);
    const branch = canvas.getByRole('combobox', { name: 'Branch' });
    await waitFor(() => expect(branch).not.toHaveAttribute('aria-disabled', 'true'), appReady);
    await choose(canvasElement, 'Branch', fixtureBranches[0].name);
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name: 'Vehicles' })).toBeVisible(),
      appReady,
    );
    await expect(canvas.getByRole('button', { name: 'Branch: Sofia Fleet' })).toBeVisible();
  },
};

export const SelectedBranchAcrossPages: Story = {
  name: 'Selected branch follows the sample pages',
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    const selected = fixtureBranches[1];
    await chooseTenant(canvasElement);
    const branch = canvas.getByRole('combobox', { name: 'Branch' });
    await waitFor(() => expect(branch).not.toHaveAttribute('aria-disabled', 'true'), appReady);
    await choose(canvasElement, 'Branch', selected.name);
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));

    const headerHasBranch = async (page: string) => {
      await waitFor(async () => {
        const heading = canvas.getByRole('heading', { level: 1, name: page });
        const header = heading.closest('holita-page-header');
        if (!(header instanceof HTMLElement)) {
          throw new Error(`Missing ${page} page header.`);
        }
        await expect(within(header).getByText(new RegExp(selected.name))).toBeVisible();
      }, appReady);
    };
    await headerHasBranch('Vehicles');
    await expect(canvas.getByRole('button', { name: `Branch: ${selected.name}` })).toBeVisible();

    for (const page of [
      'Overview',
      'Alerts',
      'Trips',
      'Vehicles',
      'Drivers',
      'Devices',
      'Maintenance',
      'General',
    ]) {
      await userEvent.click(canvas.getByRole('link', { name: page }));
      await headerHasBranch(page);
    }
    await expect(canvas.getByRole('button', { name: `Branch: ${selected.name}` })).toBeVisible();
    await waitFor(() =>
      expect(canvas.getByRole('textbox', { name: /Branch name/ })).toHaveValue(selected.name),
    );
  },
};

export const SignOut: Story = {
  name: 'Sign out returns to login',
  play: async ({ canvasElement }) => {
    const canvas = await loginReady(canvasElement);
    await chooseTenant(canvasElement);
    const branch = canvas.getByRole('combobox', { name: 'Branch' });
    await waitFor(() => expect(branch).not.toHaveAttribute('aria-disabled', 'true'), appReady);
    await choose(canvasElement, 'Branch', fixtureBranches[0].name);
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name: 'Vehicles' })).toBeVisible(),
      appReady,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Account: Elena Petrova' }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Sign out');
    await loginReady(canvasElement);
    await expect(canvas.getByRole('combobox', { name: 'Tenant' })).toHaveTextContent(
      'Choose a tenant',
    );
    await expect(canvas.getByRole('combobox', { name: 'Branch' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  },
};

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
