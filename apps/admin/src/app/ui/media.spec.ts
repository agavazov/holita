import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { below, breakpointWidth, type BreakpointName } from './media';

function resize(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('media breakpoints', () => {
  afterEach(() => {
    resize(1024);
  });

  it('reads every breakpoint from the global custom properties', () => {
    const names: readonly BreakpointName[] = ['sm', 'md', 'lg', 'xl', 'xxl'];
    expect(names.map((name) => breakpointWidth(name))).toEqual([640, 768, 1024, 1280, 1536]);
  });

  it('switches at the same pixel as the Sass mixins and stops listening on destroy', () => {
    resize(1023);
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const narrow = runInInjectionContext(injector, () => below('lg'));
    expect(narrow()).toBe(true);
    resize(1024);
    expect(narrow()).toBe(false);
    resize(800);
    expect(narrow()).toBe(true);
    injector.destroy();
    resize(1280);
    expect(narrow()).toBe(true);
  });

  it('fails loudly when the global styles are missing', () => {
    // A document without the generated custom properties.
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(document.createElement('div').style);
    try {
      expect(() => breakpointWidth('lg')).toThrow('Global styles are not loaded');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
