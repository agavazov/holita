import { TabList } from 'primeng/tabs';
import type { TabListPassThrough } from 'primeng/types/tabs';

const resizeObservers = new WeakMap<TabList, ResizeObserver>();

/** PrimeNG scrolls on selection changes; keep that selection visible when its viewport resizes. */
export const tabListPt: TabListPassThrough = ({ instance }) => {
  if (!(instance instanceof TabList)) {
    return {};
  }

  return {
    hooks: {
      onAfterViewInit: () => {
        const content = instance.content()?.nativeElement;
        if (!content) {
          return;
        }
        const observer = new ResizeObserver(() => {
          instance.scrollToActiveTab();
        });
        observer.observe(content);
        resizeObservers.set(instance, observer);
      },
      onDestroy: () => {
        resizeObservers.get(instance)?.disconnect();
        resizeObservers.delete(instance);
      },
    },
  };
};
