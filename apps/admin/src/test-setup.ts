// Unit-test environment for `ng test` (jsdom). Global styles are not loaded there and jsdom has
// no `matchMedia`, but every signed-in spec renders the shell, which reads the breakpoint custom
// properties and media queries through `app/ui/media.ts`. Specs switch layouts with
// `Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })` followed by
// `window.dispatchEvent(new Event('resize'))`.

// The only restatement of `styles/_breakpoints.scss`, for tests.
const breakpoints = document.createElement('style');
breakpoints.dataset['testBreakpoints'] = '';
breakpoints.textContent =
  ':root { --app-bp-sm: 640px; --app-bp-md: 768px; --app-bp-lg: 1024px; --app-bp-xl: 1280px; --app-bp-xxl: 1536px; }';
document.head.append(breakpoints);

function evaluate(query: string): boolean {
  const width = window.innerWidth;
  const conditions = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
  if (!conditions.length) return false;
  return conditions.every(([, kind, value]) => {
    const limit = Number(value);
    return kind === 'min' ? width >= limit : width <= limit;
  });
}

class TestMediaQueryListEvent extends Event implements MediaQueryListEvent {
  constructor(
    readonly matches: boolean,
    readonly media: string,
  ) {
    super('change');
  }
}

type LegacyListener = (this: MediaQueryList, event: MediaQueryListEvent) => unknown;

class TestMediaQueryList extends EventTarget implements MediaQueryList {
  matches: boolean;
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;
  private readonly legacy = new Set<LegacyListener>();

  constructor(readonly media: string) {
    super();
    this.matches = evaluate(media);
    window.addEventListener('resize', () => {
      const matches = evaluate(media);
      if (matches === this.matches) return;
      this.matches = matches;
      const event = new TestMediaQueryListEvent(matches, media);
      this.dispatchEvent(event);
      this.onchange?.call(this, event);
      for (const listener of this.legacy) listener.call(this, event);
    });
  }

  addListener(listener: LegacyListener | null): void {
    if (listener) this.legacy.add(listener);
  }

  removeListener(listener: LegacyListener | null): void {
    if (listener) this.legacy.delete(listener);
  }
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList => new TestMediaQueryList(query),
});

// jsdom has no ResizeObserver; PrimeNG's TabList observes its size. Nothing is laid out in jsdom,
// so an observer that never reports is exact.
class TestResizeObserver implements ResizeObserver {
  observe(): void {
    /* no layout in jsdom */
  }
  unobserve(): void {
    /* no layout in jsdom */
  }
  disconnect(): void {
    /* no layout in jsdom */
  }
}

if (!('ResizeObserver' in globalThis))
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: TestResizeObserver,
  });
