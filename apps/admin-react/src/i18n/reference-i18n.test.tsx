import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App.js';
import { DataError } from '../data/data-provider.js';
import { VenueForm } from '../features/reference/venues/venue-form.js';
import { TagForm } from '../features/reference/tags/tag-form.js';
import { FormExamples } from '../features/prototype/ui-catalog/form-examples.js';
import { event, mockGraphQL, result, storeA, stores } from '../test/graphql-fixture.js';
import { TestProviders } from '../test/test-providers.js';
import { createAdminI18n } from './i18n.js';
import { createFormat } from './use-format.js';
import {
  eventDraft,
  eventInput,
  validateEventDraft,
} from '../features/reference/events/event-form-state.js';

function Bulgarian({ children }: { children: React.ReactNode }) {
  return <TestProviders language="bg">{children}</TestProviders>;
}

describe('translated Reference and Prototype', () => {
  it('validates lookup fields in Bulgarian and leaves server field messages unchanged', () => {
    const submit = vi.fn();
    render(
      <VenueForm
        pending={false}
        error={new DataError('Backend capacity conflict.', 'trace-1')}
        onSubmit={submit}
        onCancel={() => undefined}
        onChange={() => undefined}
      />,
      { wrapper: Bulgarian },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Запази мястото' }));
    expect(screen.getByText('Въведи име на мястото.')).toBeInTheDocument();
    expect(screen.getByText('Въведи град.')).toBeInTheDocument();
    expect(screen.getByLabelText('Име', { exact: true })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Backend capacity conflict.');
    expect(screen.getByRole('alert')).toHaveTextContent('Идентификатор на заявката: trace-1');
    expect(submit).not.toHaveBeenCalled();
  });

  it('uses Bulgarian shared length validation without changing Tag normalization', () => {
    const submit = vi.fn();
    render(
      <TagForm
        pending={false}
        error={null}
        onSubmit={submit}
        onCancel={() => undefined}
        onChange={() => undefined}
      />,
      { wrapper: Bulgarian },
    );
    const name = screen.getByLabelText('Име', { exact: true });
    fireEvent.change(name, { target: { value: 'я'.repeat(101) } });
    fireEvent.click(screen.getByRole('button', { name: 'Запази етикета' }));
    expect(screen.getByText('Използвай най-много 100 символа.')).toBeInTheDocument();
    fireEvent.change(name, { target: { value: '  Конференция  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Запази етикета' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith({
      name: 'Конференция',
      color: '#315ed0',
      active: true,
    });
  });

  it('renders Bulgarian MUI options and catalog validation using only local preview state', async () => {
    render(<FormExamples />, { wrapper: Bulgarian });
    fireEvent.click(screen.getByRole('button', { name: 'Запази примера' }));
    expect(screen.getByText('Въведи име.')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Отвори' }));
    expect(screen.getByRole('option', { name: 'Сезонно' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Сезонно' }));
    expect(screen.getByRole('button', { name: 'Изчисти' })).toBeInTheDocument();
  });

  it('saves a Bulgarian Event through Refine with captured locale, exact money and unchanged API enums', async () => {
    const row = event();
    const transport = mockGraphQL((call) => {
      if (call.operation === 'ListStores') return result({ stores });
      if (call.operation === 'GetReferenceEvent') return result({ referenceEvent: row });
      if (call.operation === 'UpdateReferenceEvent') return result({ updateReferenceEvent: row });
      if (call.operation === 'ListReferenceEventMedia') return result({ referenceEventMedia: [] });
      if (call.operation === 'ListReferenceSessions') return result({ referenceSessions: [] });
      if (call.operation === 'ListReferenceVenues')
        return result({ referenceVenues: { items: [], total: 0 } });
      return result({ referenceTags: { items: [], total: 0 } });
    });
    const router = createMemoryRouter([{ path: '*', element: <App /> }], {
      initialEntries: [`/bg/stores/${storeA}/reference/events/${row.id}/edit`],
    });
    render(<RouterProvider router={router} />);
    const title = await screen.findByLabelText('Заглавие', {}, { timeout: 5000 });
    fireEvent.change(title, { target: { value: '  Преведено събитие  ' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Запази събитието' }));
    await waitFor(() => {
      expect(
        transport.calls.find((call) => call.operation === 'UpdateReferenceEvent'),
      ).toMatchObject({
        language: 'bg',
        storeId: storeA,
        variables: {
          input: {
            title: 'Преведено събитие',
            budget: '9999999999.99',
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            status: 'DRAFT',
            format: 'ONLINE',
          },
        },
      });
    });
    expect(await screen.findByText('Събитието е запазено.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/bg/stores/${storeA}/reference/events/${row.id}`);
  });

  it('formats Sofia display dates and exact EUR decimals while preserving stored values and validation', () => {
    const bg = createFormat('bg'),
      en = createFormat('en');
    expect(bg.dateTime('2026-11-01T10:00:00Z')).toContain('12:00');
    expect(bg.dateTime('2026-11-01T10:00:00Z')).toContain('01.11.2026');
    expect(en.dateTime('2026-11-01T10:00:00Z')).toBe('01 Nov 2026, 12:00');
    expect(bg.decimal('9999999999.99').replace(/\s/g, '')).toBe('9999999999,99');
    expect(en.decimal('9999999999.99')).toBe('9,999,999,999.99');
    expect(bg.number(12345).replace(/\s/g, '')).toBe('12345');
    const row = event();
    const values = eventDraft(row);
    const validate = createAdminI18n('bg').getFixedT('bg', 'validation');
    expect(eventInput(values, row).budget).toBe('9999999999.99');
    expect(
      validateEventDraft({ ...values, startsAt: '2026-03-29T03:30' }, row, validate).startsAt,
    ).toContain('смяната на часовника');
  });
});
