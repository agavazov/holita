import { TestProviders } from '../../test/test-providers.js';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { PrototypeControls } from './prototype-controls.js';

describe('Prototype Reset controls', () => {
  it('submits Reset once before pending controls render and permits retry after failure', async () => {
    let failReset: ((failure: Error) => void) | undefined;
    const reset = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          failReset = reject;
        }),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PrototypeControls onReset={reset} />
      </QueryClientProvider>,
      { wrapper: TestProviders },
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    const confirm = screen.getByRole('button', { name: 'Reset data' });
    act(() => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    act(() => {
      failReset?.(new Error('Storage full'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset demo data' })).toBeEnabled();
    });
    reset.mockResolvedValueOnce();
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    await user.click(screen.getByRole('button', { name: 'Reset data' }));
    await waitFor(() => {
      expect(reset).toHaveBeenCalledTimes(2);
    });
  });
});
