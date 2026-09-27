import { describe, expect, it } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { descriptionHtml } from './description-html.js';

describe('Event description HTML contract', () => {
  it('preserves allowed formatting and web links, normalizes pasted emphasis and is idempotent', () => {
    const input =
      '<h2>Discover</h2><p><b>Bold</b> and <i>italic</i><br />text</p><h3>Agenda</h3><ul><li><p>One</p></li></ul><ol start="3"><li><p>Three</p></li></ol><p><a href="https://example.com/?a=1&amp;b=2">Details</a></p>';
    const clean = descriptionHtml(input);
    expect(clean).toBe(
      input
        .replace('<b>', '<strong>')
        .replace('</b>', '</strong>')
        .replace('<i>', '<em>')
        .replace('</i>', '</em>'),
    );
    expect(descriptionHtml(clean)).toBe(clean);
  });
  it('removes scripts, embeds, media, event handlers and presentation attributes', () => {
    expect(
      descriptionHtml(
        '<h2 id="x" style="color:red" onclick="alert(1)">Title</h2><script>alert(1)</script><style>p{display:none}</style><p><img src="x" onerror="alert(1)">Safe<iframe src="https://example.com"></iframe><video src="x"></video><svg onload="alert(1)"></svg></p>',
      ),
    ).toBe('<h2>Title</h2><p>Safe</p>');
  });
  it('removes unsafe and relative link destinations while preserving their visible text', () => {
    for (const href of [
      'javascript:alert(1)',
      'jav&#x61;script:alert(1)',
      'java&#10;script:alert(1)',
      'data:text/html,test',
      '//example.com',
      '/settings',
      'mailto:a@example.com',
      'https://user:secret@example.com',
      'https://',
    ]) {
      expect(
        descriptionHtml(`<p><a href="${href}" target="_blank" onclick="alert(1)">Read</a></p>`),
      ).toBe('<p><a>Read</a></p>');
    }
  });
  it('treats absent and visually empty descriptions as null', () => {
    for (const input of [
      undefined,
      null,
      '',
      ' ',
      '<p><br></p>',
      '<p>&nbsp;</p>',
      '<script>alert(1)</script>',
    ])
      expect(descriptionHtml(input)).toBeNull();
  });
  it('limits UTF-8 bytes before sanitization, including content that would be removed', () => {
    const boundary = `<p>${'я'.repeat(51196)}x</p>`;
    expect(Buffer.byteLength(boundary)).toBe(102400);
    expect(descriptionHtml(boundary)).toBe(boundary);
    for (const input of [boundary + 'x', `<script>${'a'.repeat(102400)}</script>`])
      expect(() => descriptionHtml(input)).toThrow(BadRequestException);
  });
  it('rejects escaping expansion that would exceed the limit on a subsequent edit', () => {
    expect(() => descriptionHtml('&'.repeat(22000))).toThrow(BadRequestException);
  });
  it('rejects non-text values and NUL with an attributable field error', () => {
    for (const input of [42, {}, 'a\0b']) {
      try {
        descriptionHtml(input);
        throw new Error('Expected validation to reject the input');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException)
          expect(error.getResponse()).toMatchObject({ fieldErrors: [{ path: 'descriptionHtml' }] });
      }
    }
  });
});
