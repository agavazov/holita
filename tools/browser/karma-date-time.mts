import { expect, type Page } from '@playwright/test';

/** PrimeNG parses typed calendar values on keydown; the API clock remains a separate text field. */
export async function enterKarmaDateTime(
  page: Page,
  label: string,
  date: string,
  time: string,
): Promise<void> {
  const calendar = page.getByRole('combobox', { name: label, exact: true });
  await calendar.press('ControlOrMeta+A');
  await calendar.press('Backspace');
  await calendar.pressSequentially(date);
  await calendar.press('Escape');
  await expect(calendar).toHaveValue(date);
  const clock = page.getByRole('textbox', { name: `${label}: time (HH:mm:ss)`, exact: true });
  await clock.press('ControlOrMeta+A');
  await clock.press('Backspace');
  await clock.pressSequentially(time);
  await clock.press('Tab');
  await expect(clock).toHaveValue(time);
}
