import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CardBack from './CardBack.jsx';

export default function DrawMotion({ session, targetRef, onPhase, onDone, onImageError }) {
  const root = useRef();
  const flight = useRef();
  const face = useRef();
  const callbacks = useRef();
  callbacks.current = { onPhase, onDone, onImageError };
  const { origin, card, phase, motion } = session;

  useEffect(() => {
    let active = true;
    const image = face.current;
    const ready = () => {
      clearTimeout(timeout);
      if (active) callbacks.current.onPhase(motion === 'full' ? 'shuffle' : 'reveal');
    };
    const fail = () => {
      clearTimeout(timeout);
      if (active) {
        callbacks.current.onImageError();
        callbacks.current.onDone();
      }
    };
    const timeout = setTimeout(fail, 4000);
    if (image.complete && image.naturalWidth > 0) ready();
    else if (image.decode) image.decode().then(ready, fail);
    else {
      image.addEventListener('load', ready);
      image.addEventListener('error', fail);
    }

    const skip = () => callbacks.current.onDone();
    const onVisibility = () => {
      if (document.hidden) skip();
    };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = (event) => {
      if (session.followSystem && event.matches) skip();
    };
    window.addEventListener('resize', skip);
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('touchmove', skip, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    media.addEventListener('change', onPreference);
    return () => {
      active = false;
      clearTimeout(timeout);
      image.removeEventListener('load', ready);
      image.removeEventListener('error', fail);
      window.removeEventListener('resize', skip);
      window.removeEventListener('wheel', skip);
      window.removeEventListener('touchmove', skip);
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', onPreference);
    };
  }, [card.id, origin, motion, session.followSystem]);

  useEffect(() => {
    if (!['shuffle', 'reveal'].includes(phase)) return;
    let complete = false;
    const duration = phase === 'shuffle' ? 480 : motion === 'full' ? 1100 : 240;
    const element = motion === 'gentle' ? face.current : flight.current;
    const next = () => {
      if (complete) return;
      complete = true;
      callbacks.current.onPhase(phase === 'shuffle' ? 'reveal' : 'landing');
    };
    const ended = (event) => {
      if (event.target === element) next();
    };
    element.addEventListener('animationend', ended);
    const fallback = setTimeout(next, duration + 200);
    return () => {
      complete = true;
      clearTimeout(fallback);
      element.removeEventListener('animationend', ended);
    };
  }, [phase, motion]);

  useLayoutEffect(() => {
    if (phase !== 'landing') return;
    const element = root.current;
    const target = targetRef.current?.getBoundingClientRect();
    if (!element || !target) {
      callbacks.current.onDone();
      return;
    }
    element.style.setProperty('--to-x', `${target.left}px`);
    element.style.setProperty('--to-y', `${target.top}px`);
    element.style.setProperty('--to-scale-x', target.width / origin.width);
    element.style.setProperty('--to-scale-y', target.height / origin.height);
    let complete = false;
    const done = () => {
      if (!complete) {
        complete = true;
        callbacks.current.onDone();
      }
    };
    const ended = (event) => {
      if (event.target === element) done();
    };
    element.addEventListener('animationend', ended);
    const fallback = setTimeout(done, (motion === 'full' ? 420 : 160) + 200);
    return () => {
      complete = true;
      clearTimeout(fallback);
      element.removeEventListener('animationend', ended);
    };
  }, [phase, origin, motion, targetRef]);

  return createPortal(
    <div
      className="draw-transition"
      ref={root}
      aria-hidden="true"
      data-phase={phase}
      data-motion={motion}
      style={{
        width: origin.width,
        height: origin.height,
        '--from-x': `${origin.left}px`,
        '--from-y': `${origin.top}px`,
        transform: `translate(${origin.left}px, ${origin.top}px)`,
      }}
    >
      <div className="draw-flight" ref={flight}>
        <CardBack className="draw-reverse" />
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
