import React, { useEffect, useRef } from 'react';

export default function VoiceWaveform({ stream, active, cancelling }) {
  const canvas = useRef();
  useEffect(() => {
    const surface = canvas.current;
    const drawing = surface.getContext('2d');
    if (!drawing) return;
    let context, source, analyser, frame;
    const data = new Uint8Array(256);
    if (stream && active) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
        source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        context.resume().catch(() => {});
      } catch {
        /* Recording remains usable if visualization is unavailable. */
      }
    }
    const draw = () => {
      drawing.clearRect(0, 0, 640, 44);
      drawing.fillStyle = cancelling ? '#913d30' : active ? '#bc5845' : '#a7b8a0';
      if (analyser) analyser.getByteTimeDomainData(data);
      for (let index = 0; index < 43; index++) {
        let peak = 0;
        for (let offset = 0; offset < 5; offset++)
          peak = Math.max(peak, analyser ? Math.abs(data[index * 5 + offset] - 128) / 128 : 0);
        const height = Math.max(3, Math.min(38, peak * 100));
        drawing.beginPath();
        drawing.roundRect(6 + index * 14.7, (44 - height) / 2, 4, height, 2);
        drawing.fill();
      }
      if (active) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      source?.disconnect();
      analyser?.disconnect();
      context?.close().catch(() => {});
    };
  }, [stream, active, cancelling]);
  return (
    <canvas ref={canvas} className="voice-waveform" width="640" height="44" aria-hidden="true" />
  );
}
