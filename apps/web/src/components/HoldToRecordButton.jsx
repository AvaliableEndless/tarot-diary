import React, { useEffect, useRef, useState } from 'react';

export default function HoldToRecordButton({
  onTap,
  onHoldStart,
  onHoldMove,
  onHoldEnd,
  preload,
  className = '',
  children,
  ...props
}) {
  const gesture = useRef(null);
  const timer = useRef();
  const ignoreClickUntil = useRef(0);
  const callbacks = useRef();
  callbacks.current = { onTap, onHoldStart, onHoldMove, onHoldEnd, preload };
  const [holding, setHolding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const finish = (cancelled) => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    clearTimeout(timer.current);
    setHolding(false);
    setCancelling(false);
    ignoreClickUntil.current = performance.now() + 500;
    if (current.started) callbacks.current.onHoldEnd(cancelled || current.cancelled);
    else if (!cancelled && !current.moved) callbacks.current.onTap();
  };

  useEffect(() => {
    const cancel = () => finish(true);
    const hide = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hide);
      clearTimeout(timer.current);
      if (gesture.current?.started) callbacks.current.onHoldEnd(true);
    };
  }, []);

  return (
    <button
      {...props}
      type="button"
      className={`${className} hold-to-record ${holding ? 'is-holding' : ''} ${cancelling ? 'is-cancelling' : ''}`}
      aria-pressed={holding}
      title={props.title || '按住说话，松开结束'}
      onPointerDown={(event) => {
        if (event.isPrimary === false || event.button !== 0 || gesture.current) return;
        event.preventDefault();
        callbacks.current.preload?.();
        const current = {
          pointerId: event.pointerId,
          y: event.clientY,
          x: event.clientX,
          started: false,
          moved: false,
          cancelled: false,
        };
        gesture.current = current;
        event.currentTarget.setPointerCapture(event.pointerId);
        timer.current = setTimeout(() => {
          if (gesture.current !== current || current.moved) return;
          if (callbacks.current.onHoldStart() === false) {
            gesture.current = null;
            return;
          }
          current.started = true;
          setHolding(true);
        }, 200);
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        if (!current.started) {
          if (
            Math.abs(event.clientY - current.y) > 12 ||
            Math.abs(event.clientX - current.x) > 12
          ) {
            current.moved = true;
            clearTimeout(timer.current);
          }
          return;
        }
        const cancelled = event.clientY < current.y - 72;
        if (cancelled !== current.cancelled) {
          current.cancelled = cancelled;
          setCancelling(cancelled);
          callbacks.current.onHoldMove(cancelled);
        }
      }}
      onPointerUp={(event) => {
        if (gesture.current?.pointerId === event.pointerId) finish(false);
      }}
      onPointerCancel={() => finish(true)}
      onLostPointerCapture={() => {
        if (gesture.current) finish(true);
      }}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0 || performance.now() >= ignoreClickUntil.current)
          callbacks.current.onTap();
      }}
    >
      {children}
    </button>
  );
}
