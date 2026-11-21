import { useEffect } from 'react';

export function useViewportMetrics() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => {
      const unzoomed = !viewport.scale || viewport.scale === 1;
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const keyboardOffset = unzoomed
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      root.style.setProperty(
        '--visible-height',
        `${unzoomed ? viewport.height : window.innerHeight}px`,
      );
      root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
      root.classList.toggle('keyboard-open', editing && keyboardOffset > 120);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      root.style.removeProperty('--visible-height');
      root.style.removeProperty('--keyboard-offset');
      root.classList.remove('keyboard-open');
    };
  }, []);
}
