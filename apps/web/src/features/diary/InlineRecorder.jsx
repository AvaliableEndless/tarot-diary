import React, { useEffect, useRef } from 'react';
import { Check, Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import HoldToRecordButton from '../../components/HoldToRecordButton.jsx';
import VoiceWaveform from './VoiceWaveform.jsx';
import AudioClips from './AudioClips.jsx';

export default function InlineRecorder({
  phase,
  captureSource,
  text,
  interim,
  seconds,
  error,
  asr,
  clips,
  stream,
  holding,
  cancelling,
  saving,
  dirty,
  canSave,
  active,
  draftRef,
  title,
  textId = 'today-journal-text',
  textLabel = '此刻的一句话',
  history = false,
  onTextChange,
  onStart,
  onStop,
  onPause,
  onRemoveAudio,
  onSave,
  onDiscard,
  voiceGesture,
  discardPrompt,
}) {
  const live = useRef();
  const writing = useRef();
  useEffect(() => {
    if (live.current) live.current.scrollTop = live.current.scrollHeight;
  }, [text, interim]);
  useEffect(() => {
    if (phase === 'finished' && draftRef.current)
      draftRef.current.scrollTop = draftRef.current.scrollHeight;
  }, [phase, draftRef]);
  useEffect(() => {
    if (!holding || captureSource !== 'mobile-nav') return;
    const bottom = writing.current.getBoundingClientRect().bottom;
    const navTop = document.querySelector('.bottom-nav')?.getBoundingClientRect().top;
    if (navTop > 0 && bottom + 12 > navTop)
      window.scrollBy({ top: bottom + 12 - navTop, behavior: 'instant' });
  }, [holding, captureSource]);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const label = cancelling
    ? '松开取消'
    : {
        requesting: '等待麦克风权限',
        recording: '正在听',
        paused: '录音暂停',
        processing: '正在保留声音',
      }[phase];
  return (
    <section
      className={`inline-recorder voice-space ${phase} ${history ? 'history-editor' : ''} ${holding ? 'is-holding' : ''} ${cancelling ? 'is-cancelling' : ''}`}
      aria-label={title}
      data-phase={phase}
    >
      <div className="inline-note-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onDiscard}
          aria-label="放弃本次修改"
          title="放弃本次修改"
          disabled={!dirty || active || saving}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <div className="inline-voice-status" role="status">
        <span>
          {label && (
            <>
              <i className="record-dot" />
              {label}
            </>
          )}
        </span>
        <span className="timer">{active || seconds > 0 ? time : ''}</span>
      </div>
      <VoiceWaveform stream={stream} active={phase === 'recording'} cancelling={cancelling} />
      <div className="inline-writing" ref={writing}>
        {active ? (
          <div className="live-transcript" ref={live} aria-live="polite" aria-atomic="false">
            {text}
            {interim && (
              <span className="live-interim">
                {text && '\n'}
                {interim}
              </span>
            )}
            {!text && !interim && (
              <span className="live-placeholder">
                {phase === 'requesting' ? '等待麦克风开启…' : '正在听你说…'}
              </span>
            )}
            {phase === 'recording' && <span className="voice-caret" aria-hidden="true" />}
          </div>
        ) : (
          <textarea
            ref={draftRef}
            id={textId}
            aria-label={textLabel}
            placeholder={history ? '这一天，发生了什么？' : '这一刻，想留下一句什么？'}
            rows={3}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            disabled={saving}
          />
        )}
      </div>
      {error && (
        <p className="record-error" role="alert">
          {error}
        </p>
      )}
      {asr && (
        <p className="asr-note" role="status">
          {asr}
        </p>
      )}
      <div className="inline-playback">
        <AudioClips
          clips={clips}
          onRemove={onRemoveAudio}
          disabled={saving}
          paused={active}
          collapsible
        />
        {holding && (
          <p className="inline-gesture">
            {cancelling ? '松开取消 · 移回继续' : '上滑取消 · 松开结束'}
          </p>
        )}
      </div>
      <div className="inline-note-actions record-save-area">
        <HoldToRecordButton
          source="inline"
          {...voiceGesture}
          className="icon-button inline-microphone today-record-button start-record"
          onTap={['recording', 'paused'].includes(phase) ? onStop : onStart}
          disabled={saving || (!holding && active && !['recording', 'paused'].includes(phase))}
          aria-label={
            ['recording', 'paused'].includes(phase)
              ? '结束录音'
              : text || clips.length
                ? '追加语音'
                : '开始录音'
          }
          title={['recording', 'paused'].includes(phase) ? '结束录音' : '追加语音，按住说话'}
        >
          {['recording', 'paused'].includes(phase) ? (
            <Square size={18} fill="currentColor" />
          ) : (
            <Mic size={21} />
          )}
        </HoldToRecordButton>
        {['recording', 'paused'].includes(phase) && (
          <>
            <button
              className="icon-button inline-pause"
              onClick={onPause}
              disabled={holding}
              aria-label={phase === 'paused' ? '继续录音' : '暂停录音'}
              title={phase === 'paused' ? '继续录音' : '暂停录音'}
            >
              {phase === 'paused' ? <Play size={19} /> : <Pause size={19} />}
            </button>
          </>
        )}
        <button
          className="primary-button save-button"
          onClick={onSave}
          disabled={!canSave || active || saving}
        >
          {saving ? (
            '正在留好…'
          ) : (
            <>
              <Check size={17} />
              留好这一刻
            </>
          )}
        </button>
      </div>
      {discardPrompt}
    </section>
  );
}
