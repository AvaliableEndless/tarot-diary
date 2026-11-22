import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Mic, Trash2 } from 'lucide-react';
import { getAudio } from '../../services/audio-store.js';

function AudioClip({ clip, index, showLabel, onRemove, disabled, paused }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const player = useRef();
  useEffect(() => {
    if (paused) player.current?.pause();
  }, [paused]);
  useEffect(() => {
    let live = true;
    let objectUrl;
    setError(false);
    setUrl('');
    Promise.resolve(clip.blob || getAudio(clip.id))
      .then((blob) => {
        if (!live) return;
        if (!blob) throw new Error('Missing audio');
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clip.id, clip.blob]);
  return (
    <div className="audio-clip">
      {showLabel && <span className="audio-clip-label">录音 {index + 1}</span>}
      <div className="audio-review">
        {error ? (
          <p className="record-error" role="alert">
            这段声音暂时无法读取。
          </p>
        ) : (
          <audio ref={player} controls src={url || undefined} aria-label={`录音 ${index + 1}`} />
        )}
        {onRemove && (
          <button
            className="icon-button"
            onClick={() => onRemove(clip.id)}
            disabled={disabled}
            aria-label={showLabel ? `移除录音 ${index + 1}` : '移除录音'}
            title={`移除录音 ${index + 1}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AudioClips({
  clips,
  onRemove,
  disabled = false,
  paused = false,
  collapsible = false,
}) {
  const items = clips.map((clip, index) => (
    <AudioClip
      key={clip.id}
      clip={clip}
      index={index}
      showLabel={clips.length > 1}
      onRemove={onRemove}
      disabled={disabled}
      paused={paused}
    />
  ));
  return (
    <div
      className={`audio-clips ${paused ? 'is-concealed' : ''}`}
      aria-label="原声音"
      inert={paused ? '' : undefined}
      aria-hidden={paused || undefined}
    >
      {collapsible && clips.length > 1 ? (
        <details className="audio-clip-group">
          <summary>
            <Mic size={14} />
            <span>{clips.length} 段原声音</span>
            <ChevronDown size={15} />
          </summary>
          <div className="audio-clips-list">{items}</div>
        </details>
      ) : (
        items
      )}
    </div>
  );
}
