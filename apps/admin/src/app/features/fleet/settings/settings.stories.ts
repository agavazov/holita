import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { chooseMenuItem } from '../../../../storybook/interactions';
import { exampleAt } from '../../../../storybook/samples/example-app';
import { sampleGroups, sampleVehicles } from '../../../../storybook/samples/fleet-samples';

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
if (!group) throw new Error('The sample groups are empty.');
const inUse = sampleGroups.find((item) =>
  sampleVehicles.some((vehicle) => vehicle.groupId === item.id),
);
if (!inUse) throw new Error('No sample group has vehicles.');
const appReady = { timeout: 10_000 };

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
};

export const General: Story = {
  render: exampleAt('settings/general'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole('textbox', { name: /Branch name/ })).toBeVisible(),
      appReady,
    );
    await expect(canvas.queryByRole('region', { name: 'You have unsaved changes.' })).toBeNull();
  },
};

/** A change shows the save bar; saving stores the values and shows a confirmation. */
export const GeneralUnsaved: Story = {
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
    const top = field.getBoundingClientRect().top;
    await userEvent.click(await canvas.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(canvas.getByText('Settings saved.')).toBeVisible(), {
      timeout: 3_000,
    });
    await expect(canvas.getByText('Settings saved.').closest('.p-toast-message')).not.toBeNull();
    await expect(field.getBoundingClientRect().top).toBe(top);
  },
};

export const GeneralMobile: Story = {
  name: 'General mobile',
  render: exampleAt('settings/general'),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const GeneralDark: Story = {
  name: 'General dark',
  render: exampleAt('settings/general'),
  globals: { theme: 'dark' },
};
