import { FormControl } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import {
  venueActive,
  venueCapacity,
  venueCountry,
  venueFieldErrors,
  venueText,
} from './venue-validation';

describe('Venue domain validation', () => {
  it('validates required and optional trimmed text by Unicode code points', () => {
    const name = new FormControl('  ', venueText(200, true));
    expect(name.hasError('required')).toBe(true);
    name.setValue(' ' + '😀'.repeat(200) + ' ');
    expect(name.valid).toBe(true);
    name.setValue('😀'.repeat(201));
    expect(name.hasError('maxLength')).toBe(true);
    const description = new FormControl('', venueText(2000));
    expect(description.valid).toBe(true);
    description.setValue('bad\u0000');
    expect(description.hasError('unsupported')).toBe(true);
    description.setValue('😀'.repeat(2001));
    expect(description.hasError('maxLength')).toBe(true);
    const address = new FormControl('a'.repeat(301), venueText(300));
    expect(address.hasError('maxLength')).toBe(true);
  });

  it('accepts exactly two Latin country letters and nullable positive GraphQL Int capacity', () => {
    const country = new FormControl(' bg ', venueCountry);
    expect(country.valid).toBe(true);
    for (const value of ['', 'BGR', 'БГ', '1G', 'B\u0000']) {
      country.setValue(value);
      expect(country.invalid).toBe(true);
    }
    const capacity = new FormControl<unknown>(null, venueCapacity);
    for (const value of [null, 1, 2147483647]) {
      capacity.setValue(value);
      expect(capacity.valid).toBe(true);
    }
    for (const value of [0, -1, 1.5, 2147483648, '12', NaN, Infinity]) {
      capacity.setValue(value);
      expect(capacity.invalid).toBe(true);
    }
    const active = new FormControl<unknown>(false, venueActive);
    expect(active.valid).toBe(true);
    active.setValue('false');
    expect(active.invalid).toBe(true);
  });

  it('maps only bounded, known server fields without accepting malformed extension data', () => {
    const error = new CombinedGraphQLErrors({
      errors: [
        {
          message: 'Validation failed',
          extensions: {
            fieldErrors: [
              { path: 'city', message: 'City rejected' },
              { path: 'city', message: 'Duplicate' },
              { path: 'unknown', message: 'Ignored' },
              { path: 'capacity', message: 42 },
              { path: 'address', message: 'x'.repeat(301) },
              null,
            ],
          },
        },
      ],
    });
    expect(venueFieldErrors(error)).toEqual({ city: 'City rejected' });
    expect(venueFieldErrors(new Error('Unavailable'))).toEqual({});
  });
});
