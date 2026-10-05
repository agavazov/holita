import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataError } from '../../../data/data-provider.js';
import { TestProviders } from '../../../test/test-providers.js';
import { VenueForm } from './venue-form.js';

const render = (ui: React.ReactNode) => rtlRender(ui, { wrapper: TestProviders });
const valid = {
  name: ' Hall ',
  city: ' Sofia ',
  countryCode: 'bg',
  capacity: 20,
  active: false,
  description: ' ',
  address: '',
};
const props = () => ({
  pending: false,
  error: null,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  onChange: vi.fn(),
});

describe('Venue form', () => {
  it('preserves a local draft across refreshed data and normalizes nullable and inactive values', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    const { rerender } = render(<VenueForm {...callbacks} initialValues={valid} />);
    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByLabelText('Name'));
    await user.paste(' Edited ');
    rerender(
      <VenueForm {...callbacks} initialValues={{ ...valid, name: 'Refreshed server value' }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Save venue' }));
    expect(callbacks.onSubmit).toHaveBeenCalledExactlyOnceWith({
      ...valid,
      name: 'Edited',
      city: 'Sofia',
      countryCode: 'BG',
      description: null,
      address: null,
    });
    expect(callbacks.onChange).toHaveBeenCalled();
  });

  it('focuses the first invalid field and clears optional capacity', async () => {
    const user = userEvent.setup();
    const callbacks = props();
    render(<VenueForm {...callbacks} initialValues={{ ...valid, city: '' }} />);
    await user.click(screen.getByRole('button', { name: 'Save venue' }));
    expect(screen.getByLabelText('City')).toHaveFocus();
    expect(screen.getByText('Enter a city.')).toBeVisible();
    expect(callbacks.onSubmit).not.toHaveBeenCalled();
    await user.paste('Sofia');
    await user.clear(screen.getByRole('spinbutton', { name: 'Capacity' }));
    await user.click(screen.getByRole('button', { name: 'Save venue' }));
    expect(callbacks.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ capacity: null }));
  });

  it('matches Unicode limits and rejects unsupported characters and invalid capacity', () => {
    const callbacks = props();
    render(<VenueForm {...callbacks} initialValues={{ ...valid, name: '😀'.repeat(200) }} />);
    const save = screen.getByRole('button', { name: 'Save venue' });
    fireEvent.click(save);
    expect(callbacks.onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bad\u0000name' } });
    fireEvent.click(save);
    expect(screen.getByText('Remove unsupported characters.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '😀'.repeat(201) } });
    fireEvent.click(save);
    expect(screen.getByText('Use at most 200 characters.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Venue' } });
    for (const capacity of ['0', '1.5', '2147483648']) {
      fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: capacity } });
      fireEvent.click(save);
      expect(screen.getByText('Enter a positive whole number.')).toBeVisible();
    }
    expect(callbacks.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows server field errors and request diagnostics and focuses the affected field', () => {
    const callbacks = props();
    const { rerender } = render(<VenueForm {...callbacks} initialValues={valid} />);
    rerender(
      <VenueForm
        {...callbacks}
        initialValues={valid}
        error={
          new DataError('Check the location.', 'venue-request', [
            { path: 'address', message: 'Use a shorter address.' },
          ])
        }
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Request ID: venue-request');
    expect(screen.getByText('Use a shorter address.')).toBeVisible();
    expect(screen.getByLabelText('Address')).toHaveFocus();
  });

  it('disables edits and duplicate submission while pending', () => {
    const callbacks = props();
    render(<VenueForm {...callbacks} initialValues={valid} pending />);
    for (const label of ['Name', 'City', 'Country code', 'Address', 'Description', 'Capacity']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole('switch', { name: 'Active' })).toBeDisabled();
    const save = screen.getByRole('button', { name: 'Save venue' });
    expect(save).toBeDisabled();
    const form = save.closest('form');
    if (!form) throw new Error('Missing Venue form.');
    fireEvent.submit(form);
    expect(callbacks.onSubmit).not.toHaveBeenCalled();
  });
});
