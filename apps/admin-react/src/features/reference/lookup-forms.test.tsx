import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataError } from '../../data/data-provider.js';
import { TestProviders } from '../../test/test-providers.js';
import { SpeakerForm } from './speakers/speaker-form.js';
import { TagForm } from './tags/tag-form.js';

const render = (ui: React.ReactNode) => rtlRender(ui, { wrapper: TestProviders });
const props = () => ({
  pending: false,
  error: null,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  onChange: vi.fn(),
});

describe('Speaker form', () => {
  it('keeps a refreshed draft and normalizes empty optional fields and inactive status', () => {
    const callbacks = props();
    const initialValues = { name: 'Person', email: ' ', shortBio: '', active: false };
    const { rerender } = render(<SpeakerForm {...callbacks} initialValues={initialValues} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Edited person ' } });
    rerender(
      <SpeakerForm {...callbacks} initialValues={{ ...initialValues, name: 'Server refresh' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save speaker' }));
    expect(callbacks.onSubmit).toHaveBeenCalledExactlyOnceWith({
      name: 'Edited person',
      email: null,
      shortBio: null,
      active: false,
    });
    expect(callbacks.onChange).toHaveBeenCalled();
  });

  it('focuses invalid email, bounds biography and accepts normalized contact details', () => {
    const callbacks = props();
    render(<SpeakerForm {...callbacks} initialValues={{ name: 'Person', email: 'broken' }} />);
    const save = screen.getByRole('button', { name: 'Save speaker' });
    fireEvent.click(save);
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(callbacks.onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' person@example.com ' } });
    fireEvent.change(screen.getByLabelText('Short biography'), {
      target: { value: 'x'.repeat(2001) },
    });
    fireEvent.click(save);
    expect(screen.getByLabelText('Short biography')).toHaveFocus();
    expect(screen.getByText('Use at most 2000 characters.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Short biography'), {
      target: { value: ' Biography ' },
    });
    fireEvent.click(save);
    expect(callbacks.onSubmit).toHaveBeenCalledExactlyOnceWith({
      name: 'Person',
      email: 'person@example.com',
      shortBio: 'Biography',
      active: true,
    });
  });
});

describe('Tag form', () => {
  it('validates hex colors and shares the native picker with the text draft', () => {
    const callbacks = props();
    render(
      <TagForm {...callbacks} initialValues={{ name: ' Label ', color: 'red', active: false }} />,
    );
    const save = screen.getByRole('button', { name: 'Save tag' });
    fireEvent.click(save);
    expect(screen.getByLabelText('Color')).toHaveFocus();
    expect(callbacks.onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Choose tag color'), { target: { value: '#abcdef' } });
    expect(screen.getByLabelText('Color')).toHaveValue('#abcdef');
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: ' #ABCDEF ' } });
    fireEvent.click(save);
    expect(callbacks.onSubmit).toHaveBeenCalledExactlyOnceWith({
      name: 'Label',
      color: '#abcdef',
      active: false,
    });
  });

  it('retains the draft and focuses Name after a duplicate-name response', () => {
    const callbacks = props();
    const initialValues = { name: 'Old', color: '#315ed0' };
    const { rerender } = render(<TagForm {...callbacks} initialValues={initialValues} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Taken' } });
    rerender(
      <TagForm
        {...callbacks}
        initialValues={initialValues}
        error={
          new DataError('Tag already exists.', 'tag-request', [
            { path: 'name', message: 'Use another name.' },
          ])
        }
      />,
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Taken');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('tag-request');
    expect(screen.getByText('Use another name.')).toBeVisible();
  });
});

describe.each([
  { Form: SpeakerForm, label: 'speaker', limit: 200, fields: ['Name', 'Email', 'Short biography'] },
  { Form: TagForm, label: 'tag', limit: 100, fields: ['Name', 'Color', 'Choose tag color'] },
])('$label input lifecycle', ({ Form, label, limit, fields }) => {
  it('enforces Unicode name limits, required input and unsupported characters', () => {
    const callbacks = props();
    render(<Form {...callbacks} />);
    const save = screen.getByRole('button', { name: `Save ${label}` });
    for (const value of ['', 'Bad\u0000name', '😀'.repeat(limit + 1)]) {
      fireEvent.change(screen.getByLabelText('Name'), { target: { value } });
      fireEvent.click(save);
      expect(screen.getByLabelText('Name')).toHaveFocus();
      expect(callbacks.onSubmit).not.toHaveBeenCalled();
    }
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '😀'.repeat(limit) } });
    fireEvent.click(save);
    expect(callbacks.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('blocks edits and submissions while saving', () => {
    const callbacks = props();
    render(<Form {...callbacks} pending />);
    for (const field of fields) expect(screen.getByLabelText(field)).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Active' })).toBeDisabled();
    const save = screen.getByRole('button', { name: `Save ${label}` });
    expect(save).toBeDisabled();
    const form = save.closest('form');
    if (!form) throw new Error('Missing form');
    fireEvent.submit(form);
    expect(callbacks.onSubmit).not.toHaveBeenCalled();
  });
});
