import { FormControl } from '@angular/forms';
import { speakerText, speakerActive, speakerEmail } from './speaker-validation';
describe('Speaker field validation', () => {
  it('counts trimmed Unicode code points, rejects NUL and distinguishes required from optional text', () => {
    expect(speakerText(100, true)(new FormControl(' 😀'.repeat(50).trim()))).toBeNull();
    expect(speakerText(100)(new FormControl('😀'.repeat(101)))).toEqual({ maxLength: true });
    expect(speakerText(100)(new FormControl('bad\u0000'))).toEqual({ unsupported: true });
    expect(speakerText(100, true)(new FormControl(' '))).toEqual({ required: true });
    expect(speakerText(100)(new FormControl(' '))).toBeNull();
    expect(speakerActive(new FormControl(false))).toBeNull();
  });
  it('accepts supported values and rejects malformed speakerEmail', () => {
    for (const value of ['', ' a@example.com ', '"John Doe"@example.com'])
      expect(speakerEmail(new FormControl(value))).toBeNull();
    for (const value of ['bad', 'a@b', 'a b@example.com', 'a..b@example.com', '.a@example.com'])
      expect(speakerEmail(new FormControl(value))).not.toBeNull();
  });
});
