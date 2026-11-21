import React, { useEffect, useRef } from 'react';

export default function Modal({ children, onClose }) {
  const ref = useRef();
  const requestClose = () => {
    const closeButton = ref.current?.querySelector('[data-recorder-close]');
    if (closeButton) closeButton.click();
    else onClose();
  };
  useEffect(() => {
    const before = document.activeElement;
    ref.current.focus({ preventScroll: true });
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        ref.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], audio[controls], [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length);
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
      before?.focus({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => event.target === event.currentTarget && requestClose()}
    >
      <section
        className="modal-sheet"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="拾念记录详情"
      >
        <span className="sheet-handle" />
        {children}
      </section>
    </div>
  );
}
