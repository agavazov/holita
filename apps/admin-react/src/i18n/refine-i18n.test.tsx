import { useTranslation as useRefineTranslation } from '@refinedev/core';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../App.js';
import { createAdminI18n } from './i18n.js';
import { useRefineI18nProvider } from './use-refine-i18n-provider.js';

vi.mock('../features/stores/store-workspace.js', () => ({
  StoreWorkspace: function TranslationProbe() {
    const { translate, getLocale, changeLocale } = useRefineTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <output aria-label="Current language">{getLocale()}</output>
        <output aria-label="Current address">
          {location.pathname + location.search + location.hash}
        </output>
        <span>{translate('actions.save')}</span>
        <button
          onClick={() => {
            void navigate('/bg/stores/example/products?status=ACTIVE#rows');
          }}
        >
          Open filtered Products
        </button>
        <button
          onClick={() => {
            void changeLocale('en');
          }}
        >
          Switch to English
        </button>
      </>
    );
  },
}));

function mountProvider() {
  const i18n = createAdminI18n();
  return renderHook(useRefineI18nProvider, {
    wrapper: ({ children }) => (
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </MemoryRouter>
    ),
  });
}

describe('Refine translation integration', () => {
  it('uses the current address when a retained Refine locale callback runs after navigation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Open filtered Products' }));
    await user.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByLabelText('Current address')).toHaveTextContent(
      '/en/stores/example/products?status=ACTIVE#rows',
    );
    expect(screen.getByLabelText('Current language')).toHaveTextContent('en');
  });

  it.each(['graphql', 'mock'] as const)(
    'provides reactive translations through the actual %s App',
    async (dataSource) => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <App dataSource={dataSource} />
        </MemoryRouter>,
      );
      expect(screen.getByLabelText('Current language')).toHaveTextContent('bg');
      expect(screen.getByText('Запази')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Switch to English' }));
      expect(await screen.findByText('Save')).toBeInTheDocument();
      expect(screen.getByLabelText('Current language')).toHaveTextContent('en');
    },
  );

  it('handles Refine runtime keys, options and default messages', () => {
    const { result } = mountProvider();
    expect(result.current.translate('validation:text.maxLength', { max: 50 })).toBe(
      'Използвай най-много 50 символа.',
    );
    expect(result.current.translate('unregistered', {}, 'Default message')).toBe('Default message');
    expect(result.current.translate('unregistered', 'Short default')).toBe('Short default');
    expect(result.current.translate('unregistered', { defaultValue: 'Option default' })).toBe(
      'Option default',
    );
    expect(result.current.translate('unregistered')).toBe('unregistered');
  });

  it('rejects unsupported languages without changing the current locale', async () => {
    const { result } = mountProvider();
    await act(async () => {
      await expect(result.current.changeLocale('de')).rejects.toThrow(
        'Unsupported admin language.',
      );
    });
    expect(result.current.getLocale()).toBe('bg');
  });
});
