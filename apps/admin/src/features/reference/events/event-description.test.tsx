import { render, screen } from '../../../test/render.js';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../../App.js';
import { createDataProvider } from '../../../data/data-provider.js';
import { event, mockGraphQL, result, storeA, stores } from '../../../test/graphql-fixture.js';
import {
  descriptionBytes,
  descriptionMaxBytes,
  isDescriptionLink,
  safeDescriptionHtml,
} from './description-html.js';

describe('Event rich description', () => {
  it('renders formatted API content safely in the actual overview', async () => {
    mockGraphQL((call) => {
      if (call.operation === 'ListReferenceEventMedia') return result({ referenceEventMedia: [] });
      if (call.operation === 'ListStores') return result({ stores });
      if (call.operation === 'ListReferenceSessions') return result({ referenceSessions: [] });
      return result({
        referenceEvent: {
          ...event(),
          descriptionHtml:
            '<h2>Welcome</h2><p><strong>Explore</strong> <em>together</em></p><ul><li>Workshop</li></ul><a href="https://example.com">Details</a><script>alert(1)</script><img src="x" onerror="alert(1)"><p style="color:red" onclick="alert(1)"><a href="javascript:alert(1)">Unsafe</a></p>',
        },
      });
    });
    const router = createMemoryRouter(
      [
        {
          path: '*',
          element: <App dataProvider={createDataProvider('http://127.0.0.1:11080/graphql')} />,
        },
      ],
      {
        initialEntries: [`/en/stores/${storeA}/reference/events/${event().id}`],
      },
    );
    render(<RouterProvider router={router} />);
    const description = await screen.findByLabelText('Description');
    expect(description.querySelector('h2')).toHaveTextContent('Welcome');
    expect(description.querySelector('strong')).toHaveTextContent('Explore');
    expect(description.querySelector('em')).toHaveTextContent('together');
    expect(description.querySelector('li')).toHaveTextContent('Workshop');
    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.getByText('Unsafe')).not.toHaveAttribute('href');
    expect(
      description.querySelector('script,img,iframe,svg,[style],[onclick],[onerror]'),
    ).toBeNull();
  });
  it('counts UTF-8 bytes and accepts only absolute web links', () => {
    expect(descriptionBytes('я'.repeat(51200))).toBe(descriptionMaxBytes);
    expect(descriptionBytes(null)).toBe(0);
    expect(isDescriptionLink('https://example.com/path?q=1')).toBe(true);
    for (const value of [
      'javascript:alert(1)',
      '/relative',
      '//example.com',
      'https://user:pass@example.com',
    ])
      expect(isDescriptionLink(value)).toBe(false);
    expect(
      safeDescriptionHtml(
        '<p data-id="a" id="location" style="color:red">Safe</p><svg onload="alert(1)"></svg>',
      ),
    ).toBe('<p>Safe</p>');
  });
});
