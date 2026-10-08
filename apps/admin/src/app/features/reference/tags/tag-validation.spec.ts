import { FormControl } from '@angular/forms';
import { tagText, tagActive, tagColor } from './tag-validation';
describe('Tag field validation', () => {
  it('counts trimmed Unicode code points, rejects NUL and distinguishes required from optional text', () => {
    expect(tagText(100, true)(new FormControl(' 😀'.repeat(50).trim()))).toBeNull();
    expect(tagText(100)(new FormControl('😀'.repeat(101)))).toEqual({ maxLength: true });
    expect(tagText(100)(new FormControl('bad\u0000'))).toEqual({ unsupported: true });
    expect(tagText(100, true)(new FormControl(' '))).toEqual({ required: true });
    expect(tagText(100)(new FormControl(' '))).toBeNull();
    expect(tagActive(new FormControl(false))).toBeNull();
  });
  it('accepts supported values and rejects malformed tagColor', () => {
    for (const value of ['#abcdef', ' #ABCDEF '])
      expect(tagColor(new FormControl(value))).toBeNull();
    for (const value of ['', '#abc', '#gggggg', 'red', '#1234567'])
      expect(tagColor(new FormControl(value))).not.toBeNull();
  });
});
