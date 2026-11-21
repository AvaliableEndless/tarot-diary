import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CardBack from './CardBack.jsx';

export default function DrawTransition({ session, targetRef, onPhase, onDone, onImageError }) {
  const root = useRef();
  const flight = useRef();
  const reverse = useRef();
  const face = useRef();
  const callbacks = useRef();
  callbacks.current = { onPhase, onDone, onImageError };
  const { origin, card, phase } = session;

  useEffect(() => {
    let active = true;
    const animations = [];
    const animate = (element, frames, options) => {
      const animation = element.animate(frames, { fill: 'forwards', ...options });
      animations.push(animation);
      return animation.finished;
    };
    const imageTimeout = setTimeout(() => {
      if (active) {
        callbacks.current.onImageError();
        callbacks.current.onDone();
      }
    }, 4000);

    async function run() {
      try {
        // Decode the actual draw before turning it over; never reveal an empty face.
        await face.current.decode();
        clearTimeout(imageTimeout);
        if (!active) return;
        callbacks.current.onPhase('shuffle');
        await animate(
          flight.current,
          [
            { transform: 'translate(0, 0) rotate(0deg)' },
            { transform: 'translate(-4px, -3px) rotate(-2deg)', offset: 0.3 },
            { transform: 'translate(4px, -2px) rotate(2deg)', offset: 0.65 },
            { transform: 'translate(0, 0) rotate(0deg)' },
          ],
          { duration: 480, easing: 'ease-in-out' },
        );
        if (!active) return;
        callbacks.current.onPhase('reveal');
        await Promise.all([
          animate(
            flight.current,
            [
              { transform: 'translateY(0) rotate(0deg) scale(1)' },
              { transform: 'translateY(-29px) rotate(-4deg) scale(1.035)', offset: 0.3 },
              { transform: 'translateY(-30px) rotate(-2deg) scale(1.035)', offset: 0.56 },
              { transform: 'translateY(-5px) rotate(1deg) scale(1.01)', offset: 0.88 },
              { transform: 'translateY(0) rotate(0deg) scale(1)' },
            ],
            { duration: 1100, easing: 'ease-in-out' },
          ),
          animate(
            reverse.current,
            [
              { transform: 'scaleX(1)', opacity: 1 },
              { transform: 'scaleX(1)', opacity: 1, offset: 0.27 },
              { transform: 'scaleX(0)', opacity: 1, offset: 0.52 },
              { transform: 'scaleX(0)', opacity: 0, offset: 0.53 },
              { transform: 'scaleX(0)', opacity: 0 },
            ],
            { duration: 1100, easing: 'ease-in-out' },
          ),
          animate(
            face.current,
            [
              { transform: 'scaleX(0)', opacity: 0 },
              { transform: 'scaleX(0)', opacity: 0, offset: 0.52 },
              { transform: 'scaleX(0)', opacity: 1, offset: 0.53 },
              { transform: 'scaleX(1)', opacity: 1, offset: 0.88 },
              { transform: 'scaleX(1)', opacity: 1 },
            ],
            { duration: 1100, easing: 'ease-in-out' },
          ),
        ]);
        if (active) callbacks.current.onPhase('landing');
      } catch {
        clearTimeout(imageTimeout);
        if (active) {
          callbacks.current.onImageError();
          callbacks.current.onDone();
        }
      }
    }

    const skip = () => callbacks.current.onDone();
    const onVisibility = () => {
      if (document.hidden) skip();
    };
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (event) => {
      if (event.matches) skip();
    };
    window.addEventListener('resize', skip);
    window.addEventListener('scroll', skip, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onMotionChange);
    run();
    return () => {
      active = false;
      clearTimeout(imageTimeout);
      animations.forEach((animation) => animation.cancel());
      window.removeEventListener('resize', skip);
      window.removeEventListener('scroll', skip);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, [card.id, origin]);

  useLayoutEffect(() => {
    if (phase !== 'landing') return;
    const target = targetRef.current?.getBoundingClientRect();
    if (!target || !root.current) {
      callbacks.current.onDone();
      return;
    }
    let active = true;
    const landing = root.current.animate(
      [
        { transform: `translate(${origin.left}px, ${origin.top}px) scale(1, 1)` },
        {
          transform: `translate(${target.left}px, ${target.top}px) scale(${target.width / origin.width}, ${target.height / origin.height})`,
        },
      ],
      { duration: 420, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'forwards' },
    );
    landing.finished
      .then(() => {
        if (active) callbacks.current.onDone();
      })
      .catch(() => {});
    return () => {
      active = false;
      landing.cancel();
    };
  }, [phase, origin, targetRef]);

  return createPortal(
    <div
      className="draw-transition"
      ref={root}
      aria-hidden="true"
      style={{
        width: origin.width,
        height: origin.height,
        transform: `translate(${origin.left}px, ${origin.top}px)`,
      }}
    >
      <div className="draw-flight" ref={flight}>
        <CardBack className="draw-reverse" ref={reverse} />
        <img
          className="draw-front"
          ref={face}
          src={card.image}
          alt=""
          width="360"
          height="600"
          fetchPriority="high"
        />
      </div>
    </div>,
    document.body,
  );
}
