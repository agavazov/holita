import { userEvent, within } from 'storybook/test';

/**
 * Chooses an item of an open popup menu (MenuButton, row actions) the way a pointer does: on its
 * label. p-menu handles clicks on the item's content, not on the `menuitem` element itself.
 */
export async function chooseMenuItem(root: HTMLElement, name: string): Promise<void> {
  const item = await within(root).findByRole('menuitem', { name });
  await userEvent.click(within(item).getByText(name));
}
