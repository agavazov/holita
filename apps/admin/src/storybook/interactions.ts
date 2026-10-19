import { expect, userEvent, waitFor, within } from 'storybook/test';

/** InputNumber's paste handler accepts text without deprecated synthetic keypress codes. */
export async function enterNumber(input: HTMLElement, value: number): Promise<void> {
  await userEvent.click(input);
  await userEvent.clear(input);
  await userEvent.paste(String(value));
  await userEvent.tab();
  await waitFor(() => expect(input).toHaveAttribute('aria-valuenow', String(value)));
}

/**
 * Chooses an item of an open popup menu (MenuButton, row actions) the way a pointer does: on its
 * label. p-menu handles clicks on the item's content, not on the `menuitem` element itself.
 */
export async function chooseMenuItem(root: HTMLElement, name: string): Promise<void> {
  const item = await within(root).findByRole('menuitem', { name });
  await userEvent.click(within(item).getByText(name));
}
