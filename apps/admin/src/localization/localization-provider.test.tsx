import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocalizationProvider, useLocalization } from './localization-provider.js';

function Probe() {
  const { locale, formatNumber } = useLocalization();
  return <output>{`${locale}:${formatNumber(1234.5)}`}</output>;
}

describe('LocalizationProvider', () => {
  it('synchronizes html lang and Intl formatting with the active URL locale', () => {
    const view = render(
      <LocalizationProvider locale="bg">
        <Probe />
      </LocalizationProvider>,
    );
    expect(document.documentElement).toHaveAttribute('lang', 'bg');
    expect(screen.getByText(/^bg:/)).toHaveTextContent('1234,5');

    view.rerender(
      <LocalizationProvider locale="en">
        <Probe />
      </LocalizationProvider>,
    );
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByText(/^en:/)).toHaveTextContent('1,234.5');
  });
});
