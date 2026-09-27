import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VenueForm } from './venue-form.js';

describe('Venue form', () => {
  it('preserves fields across sections and normalizes nullable and inactive values', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const change = vi.fn();
    const props = {
      initialValues: {
        name: ' Hall ',
        city: ' Sofia ',
        countryCode: 'bg',
        capacity: 20,
        active: false,
        description: ' ',
        address: '',
      },
      pending: false,
      error: null,
      onSubmit: save,
      onCancel: vi.fn(),
      onTabChange: change,
    };
    const { rerender } = render(<VenueForm {...props} tab="general" />);
    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByLabelText('Name'));
    await user.paste(' Edited ');
    rerender(<VenueForm {...props} tab="location" />);
    await user.click(screen.getByRole('button', { name: 'Save venue' }));
    await waitFor(() => {
      expect(save).toHaveBeenCalledExactlyOnceWith({
        name: 'Edited',
        city: 'Sofia',
        countryCode: 'BG',
        capacity: 20,
        active: false,
        description: null,
        address: null,
      });
    });
  });
  it('opens the section containing a required-field error', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const change = vi.fn();
    render(
      <VenueForm
        tab="general"
        onTabChange={change}
        initialValues={{ name: 'Venue', city: '', countryCode: 'BG' }}
        pending={false}
        error={null}
        onSubmit={save}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save venue' }));
    await waitFor(() => {
      expect(change).toHaveBeenCalledWith('location');
    });
    expect(save).not.toHaveBeenCalled();
  });
  it('disables edits and duplicate submission while pending', async () => {
    const save = vi.fn();
    render(
      <VenueForm
        tab="general"
        onTabChange={vi.fn()}
        pending
        error={null}
        onSubmit={save}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: /^Capacity/ })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save venue' }));
    expect(save).not.toHaveBeenCalled();
  });
});
