import React, { useEffect, useRef } from 'react';

export default function Modal({ children, onClose }) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const requestClose = () => {
    const cancelDiscard = ref.current?.querySelector('[data-cancel-discard]');
    if (cancelDiscard) {
      cancelDiscard.click();
      return;
    }
    const closeButton = ref.current?.querySelector('[data-recorder-close]');
    if (closeButton) closeButton.click();
    else closeRef.current();
  };
  useEffect(() => {
    const before = document.activeElement;
    ref.current.focus({ preventScroll: true });
    const original = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }
      if (event.key !== 'Tab') return;
      const scope = ref.current.querySelector('[role="alertdialog"]') || ref.current;
      const focusable = Array.from(
        scope.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], audio[controls], [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length);
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        ref.current.focus();
        return;
      }
      if (!scope.contains(document.activeElement) || document.activeElement === ref.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original.overflow;
      document.body.style.paddingRight = original.paddingRight;
      document.removeEventListener('keydown', onKey);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
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
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
