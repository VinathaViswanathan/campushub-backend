import { useEffect, useRef, type RefObject } from 'react';

/**
 * On the single-column (phone) layout, scrolls the element into view and focuses it once
 * on mount. Used by panels that open below the list. The element needs tabIndex={-1}.
 */
export function useRevealOnNarrowScreen<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 56rem)').matches) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
