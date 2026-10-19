import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleGroups, sampleVehicles } from '../../../../storybook/samples/fleet-samples';
import { fixtureBranches } from '../../../../storybook/session-fixtures';

/**
 * The settings examples: a short list of vehicle groups (no search, selection or paging; groups
 * with vehicles cannot be deleted, others are deleted after a confirmation) with a small drawer
 * form, and the General page form whose save bar appears while there are changes.
 */
const meta: Meta = {
  title: 'Examples/Settings',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

const [group] = sampleGroups;
if (!group) {
  throw new Error('The sample groups are empty.');
}
const inUse = sampleGroups.find((item) =>
  sampleVehicles.some((vehicle) => vehicle.groupId === item.id),
);
if (!inUse) {
  throw new Error('No sample group has vehicles.');
}
const appReady = { timeout: 10_000 };
const generalReady: NonNullable<Story['play']> = async ({ canvasElement }) => {
  await waitFor(
    () =>
      expect(
        within(canvasElement).getByRole('heading', { level: 1, name: 'General' }),
      ).toBeVisible(),
    appReady,
  );
};

async function groupsReady(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole('table')).toBeVisible(), appReady);
  return canvas;
}

export const VehicleGroups: Story = {
  name: 'Vehicle groups',
  render: exampleAt('settings/groups'),
  play: async ({ canvasElement }) => {
    const canvas = await groupsReady(canvasElement);
    await expect(
      canvas.getByText('Groups with vehicles cannot be deleted; move the vehicles first.'),
    ).toBeVisible();
  },
};

/** The group name opens its form in the drawer. */
export const EditFromList: Story = {
  name: 'Edit from the list',
  render: exampleAt('settings/groups'),
  play: async ({ canvasElement }) => {
    const canvas = await groupsReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Edit ${group.name}` }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole('dialog', { name: `Edit ${group.name}` })).toBeVisible(),
    );
  },
};

/** A group that still has vehicles keeps Delete in its row menu, disabled. */
export const GroupInUse: Story = {
  name: 'Group in use',
  render: exampleAt('settings/groups'),
  play: async ({ canvasElement }) => {
    const canvas = await groupsReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `Actions for ${inUse.name}` }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Delete' })).toBeVisible());
    await expect(body.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};

/**
 * Every sample group has vehicles, so the story creates an empty one first. Its Delete asks
 * about the group by name; afterwards a toast confirms it and focus is on the list.
 */
export const DeleteGroup: Story = {
  name: 'Delete a group',
  render: exampleAt('settings/groups?drawer=new'),
  play: async ({ canvasElement }) => {
    const name = 'Night shift';
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: 'New group' })).toBeVisible(),
      appReady,
    );
    await userEvent.type(body.getByRole('textbox', { name: /^Name/ }), name);
    await userEvent.click(body.getByRole('button', { name: 'Create group' }));
    await waitFor(() => expect(canvas.getByText(`${name} was created.`)).toBeVisible(), {
      timeout: 3_000,
    });
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'New group' })).toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: `Actions for ${name}` }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'Delete');
    const dialog = await body.findByRole('alertdialog', { name: 'Delete groups?' });
    await expect(within(dialog).getByRole('listitem')).toHaveTextContent(name);
    // The dialog fades in: wait until its content is shown.
    await waitFor(() =>
      expect(within(dialog).getByText('Vehicles are not affected.')).toBeVisible(),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(canvas.getByText('Groups deleted: 1.')).toBeVisible());
    await expect(canvas.queryByRole('button', { name: `Edit ${name}` })).toBeNull();
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 2, name: /^Groups/ })).toHaveFocus(),
    );
  },
};

export const EditGroup: Story = {
  name: 'Edit group',
  render: exampleAt(`settings/groups?drawer=${group.id}`),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(
      () => expect(body.getByRole('dialog', { name: `Edit ${group.name}` })).toBeVisible(),
      appReady,
    );
  },
};

export const GroupsEmpty: Story = {
  name: 'Vehicle groups empty',
  render: exampleAt('settings/groups?scenario=empty'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => expect(within(canvasElement).getByText('No groups yet')).toBeVisible(),
      appReady,
    );
  },
};

export const DuplicateGroup: Story = {
  name: 'Duplicate group keeps its draft',
  render: exampleAt('settings/groups?drawer=new'),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: 'New group' }, appReady);
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    await userEvent.type(name, group.name);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create group' }));
    await waitFor(() => expect(name).toBeDisabled());
    await waitFor(
      () => expect(body.getByText('A group with this name already exists.')).toBeVisible(),
      { timeout: 3_000 },
    );
    await expect(name).toBeEnabled();
    await expect(name).toHaveValue(group.name);
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(name).toHaveFocus());
  },
};

export const GroupsLoading: Story = {
  name: 'Vehicle groups loading',
  render: exampleAt('settings/groups?scenario=loading'),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByRole('heading', { level: 1, name: 'Vehicle groups' }),
        ).toBeVisible(),
      appReady,
    );
  },
};

export const GroupsError: Story = {
  name: 'Vehicle groups error and retry',
  render: exampleAt('settings/groups?scenario=error'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByText(/The groups could not be loaded/)).toBeVisible(),
      appReady,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(canvas.getByRole('table')).toBeVisible());
  },
};

export const General: Story = {
  tags: ['prototype'],
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('textbox', { name: /Branch name/ })).toBeVisible(),
      appReady,
    );
    await expect(canvas.queryByRole('region', { name: 'You have unsaved changes.' })).toBeNull();
    await expect(canvas.getByText('Demo settings')).toBeVisible();
    await expect(
      canvas.getByText(
        'Explore regional preferences, thresholds and notifications. Changes apply to this demonstration only.',
      ),
    ).toBeVisible();
  },
};

/** A change shows the save bar; saving stores the values and shows a confirmation. */
export const GeneralUnsaved: Story = {
  tags: ['prototype'],
  name: 'General with changes',
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('textbox', { name: /Branch name/ })).toBeVisible(),
      appReady,
    );
    await userEvent.type(canvas.getByRole('textbox', { name: /Branch name/ }), ' North');
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'You have unsaved changes.' })).toBeVisible(),
    );
  },
};

export const GeneralSaved: Story = {
  tags: ['prototype'],
  name: 'General saved',
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('textbox', { name: /Branch name/ })).toBeVisible(),
      appReady,
    );
    await userEvent.click(canvas.getByRole('switch', { name: 'Daily summary' }));
    const field = canvas.getByRole('textbox', { name: /Branch name/ });
    const view = canvasElement.ownerDocument.defaultView;
    const top = field.getBoundingClientRect().top + (view?.scrollY ?? 0);
    await userEvent.click(await canvas.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(canvas.getByText('Settings saved.')).toBeVisible(), {
      timeout: 3_000,
    });
    await expect(canvas.getByText('Settings saved.').closest('.p-toast-message')).not.toBeNull();
    await expect(field.getBoundingClientRect().top + (view?.scrollY ?? 0)).toBe(top);
  },
};

export const GeneralRequired: Story = {
  tags: ['prototype'],
  name: 'General required threshold',
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('spinbutton', { name: /Low fuel below/ }, appReady);
    await userEvent.clear(field);
    await userEvent.tab();
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    await waitFor(() => expect(canvas.getByText('This field is required.')).toBeVisible());
    await waitFor(() => expect(field).toHaveFocus());
    await expect(canvas.queryByText('Settings saved.')).toBeNull();
  },
};

export const GeneralSaveError: Story = {
  tags: ['prototype'],
  name: 'General failed save keeps the draft',
  render: exampleAt('settings/general?scenario=save-error'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('textbox', { name: /Branch name/ }, appReady);
    await userEvent.type(field, ' North');
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(field).toBeDisabled());
    await expect(canvas.getByRole('switch', { name: 'Daily summary' })).toBeDisabled();
    await waitFor(() => expect(canvas.getByText(/The settings could not be saved/)).toBeVisible(), {
      timeout: 3_000,
    });
    await expect(field).toBeEnabled();
    await expect(field).toHaveValue(`${fixtureBranches[0].name} North`);
    await expect(canvas.getByRole('region', { name: 'You have unsaved changes.' })).toBeVisible();
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(
      canvasElement.ownerDocument.body,
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(canvas.getByText('Settings saved.')).toBeVisible(), {
      timeout: 3_000,
    });
  },
};

export const GeneralDiscard: Story = {
  tags: ['prototype'],
  name: 'General discard restores values and focus',
  render: exampleAt('settings/general?scenario=save-error'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole('textbox', { name: /Branch name/ }, appReady);
    await userEvent.type(field, ' North');
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(canvas.getByText(/The settings could not be saved/)).toBeVisible(), {
      timeout: 3_000,
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Discard' }));
    await expect(field).toHaveValue(fixtureBranches[0].name);
    await waitFor(() =>
      expect(canvas.getByRole('heading', { level: 1, name: 'General' })).toHaveFocus(),
    );
    await expect(canvas.queryByRole('region', { name: 'You have unsaved changes.' })).toBeNull();
    await waitFor(() => expect(canvas.queryByText(/The settings could not be saved/)).toBeNull());
  },
};

export const GeneralLeaveDraft: Story = {
  tags: ['prototype'],
  name: 'General protects unsaved changes on navigation',
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const field = await canvas.findByRole('textbox', { name: /Branch name/ }, appReady);
    await userEvent.type(field, ' North');
    const unload = new Event('beforeunload', { cancelable: true });
    canvasElement.ownerDocument.defaultView?.dispatchEvent(unload);
    await expect(unload.defaultPrevented).toBe(true);
    await userEvent.click(canvas.getByRole('link', { name: 'Overview' }));
    const question = await body.findByRole('alertdialog', { name: 'Unsaved changes' });
    await userEvent.click(within(question).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(body.queryByRole('alertdialog')).toBeNull());
    await expect(field).toHaveValue(`${fixtureBranches[0].name} North`);
    await userEvent.click(canvas.getByRole('link', { name: 'Overview' }));
    const discard = await body.findByRole('alertdialog', { name: 'Unsaved changes' });
    await userEvent.click(within(discard).getByRole('button', { name: 'Discard changes' }));
    await waitFor(
      () => expect(canvas.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible(),
      appReady,
    );
  },
};

export const GeneralMobile: Story = {
  tags: ['prototype'],
  name: 'General mobile',
  render: exampleAt('settings/general'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  play: generalReady,
};

export const GeneralDark: Story = {
  tags: ['prototype'],
  name: 'General dark',
  render: exampleAt('settings/general'),
  globals: { theme: 'dark' },
  play: generalReady,
};
