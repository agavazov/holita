import { TestBed } from '@angular/core/testing';
import { Appearance } from './appearance';

describe('admin appearance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('holita.admin.theme');
    document.documentElement.classList.remove('app-dark');
    document.documentElement.style.colorScheme = '';
  });

  it('restores dark mode and persists a toggle back to light', () => {
    localStorage.setItem('holita.admin.theme', 'dark');
    const appearance = TestBed.inject(Appearance);
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    appearance.toggle();
    expect(localStorage.getItem('holita.admin.theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('keeps the theme usable and reports denied storage access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    const appearance = TestBed.inject(Appearance);
    expect(appearance.persistenceFailed()).toBe(true);
    appearance.toggle();
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(appearance.persistenceFailed()).toBe(true);
  });
});
