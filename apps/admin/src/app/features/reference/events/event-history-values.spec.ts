import { historyFieldLabel, historyOperationLabel, historyValue } from './event-history-values';

describe('Event History presentation boundary', () => {
  it('renders HTML excerpts as plain text and removes active content', () => {
    expect(
      historyValue(
        'descriptionHtml',
        '<p>Before <strong>bold</strong></p><p>After &amp; more</p><script>alert(1)</script><img src=x onerror=alert(1)>',
        'en',
      ),
    ).toBe('Before bold After & more');
    expect(historyValue('descriptionHtml', '<a href="javascript:alert(1)">Label</a>', 'bg')).toBe(
      'Label',
    );
    expect(historyValue('descriptionHtml', '<p></p>', 'en')).toBe('—');
  });
  it('keeps ordinary field values as text, with explicit null placeholders', () => {
    expect(historyValue('title', '<script>literal</script>', 'en')).toBe(
      '<script>literal</script>',
    );
    expect(historyValue('budget', '9999999999.99', 'en')).toBe('9999999999.99');
    expect(historyValue('summary', null, 'en')).toBe('—');
  });
  it('localizes lifecycle labels and preserves unknown field names', () => {
    expect(historyOperationLabel('TRASHED', 'bg')).toBe('Преместено в кошчето');
    expect(historyOperationLabel('RESTORED', 'en')).toBe('Event restored');
    expect(historyFieldLabel('descriptionHtml', 'bg')).toBe('Описание');
    expect(historyFieldLabel('unknown', 'en')).toBe('unknown');
    expect(historyValue('status', 'PUBLISHED', 'bg')).toBe('Публикувано');
    expect(historyValue('featured', 'false', 'en')).toBe('No');
  });
  it('includes the Sofia offset so repeated autumn times remain distinct', () => {
    expect(historyValue('startsAt', '2026-10-25T00:30:00Z', 'en')).toContain('03:30 +03:00');
    expect(historyValue('startsAt', '2026-10-25T01:30:00Z', 'en')).toContain('03:30 +02:00');
  });
});
