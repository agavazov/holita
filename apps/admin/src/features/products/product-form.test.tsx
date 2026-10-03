import { render as rtlRender, fireEvent, screen, waitFor } from '../../test/render.js';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { DataError } from '../../data/data-provider.js';
import { AuroraTheme } from '../../theme/aurora-theme.js';
import { ProductForm } from './product-form.js';

const render = (ui: React.ReactNode) =>
  rtlRender(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={['/en']}>
        <AuroraTheme>{children}</AuroraTheme>
      </MemoryRouter>
    ),
  });

describe('ProductForm', () => {
  it('requires name and SKU, trims input and defaults to Draft', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(<ProductForm pending={false} error={null} onSubmit={save} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('Enter a product name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a SKU.')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText('Name'));
    await user.paste('  Notebook  ');
    await user.click(screen.getByLabelText('SKU'));
    await user.paste('  NOTE-002  ');
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => {
      expect(save).toHaveBeenCalledExactlyOnceWith({
        name: 'Notebook',
        sku: 'NOTE-002',
        status: 'DRAFT',
      });
    });
  });

  it('rejects blank and overlong values without submitting', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <ProductForm
        initialValues={{ name: ' '.repeat(5), sku: 'S'.repeat(101) }}
        pending={false}
        error={null}
        onSubmit={save}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('Enter a product name.')).toBeInTheDocument();
    expect(screen.getByText('Use at most 100 characters.')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('shares edit values, displays the server error and blocks pending submission', () => {
    const save = vi.fn();
    const { rerender } = render(
      <ProductForm
        initialValues={{ name: 'Existing', sku: 'EX-1', status: 'ACTIVE' }}
        pending={false}
        error={new DataError('SKU already exists.', 'request-123')}
        onSubmit={save}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Existing');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('A record with this value already exists.');
    expect(screen.getByRole('alert')).toHaveTextContent('request-123');
    rerender(<ProductForm pending error={null} onSubmit={save} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
    const button = screen.getByRole('button', { name: 'Save product' });
    expect(button).toBeDisabled();
    const form = button.closest('form');
    if (!form) throw new Error('Expected a product form.');
    fireEvent.submit(form);
    expect(save).not.toHaveBeenCalled();
  });

  it('accepts Unicode character limits after trimming', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const name = '😀'.repeat(200);
    const sku = '🛍'.repeat(100);
    render(
      <ProductForm
        initialValues={{ name: ` ${name} `, sku, status: 'DRAFT' }}
        pending={false}
        error={null}
        onSubmit={save}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith({ name, sku, status: 'DRAFT' });
    });
  });

  it('rejects NUL characters before submitting', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <ProductForm
        initialValues={{ name: 'Bad\u0000name', sku: 'SKU', status: 'DRAFT' }}
        pending={false}
        error={null}
        onSubmit={save}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('Remove unsupported characters.')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
