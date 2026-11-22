import React, { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Check, Mic, Pause, Play, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { getCard } from '../../domain/cards.js';
import { dayAgo, shortDate } from '../../domain/dates.js';
import { reviewOptions, createReflectionPatch } from '../../domain/diary.js';
import { getAudio, putAudio, deleteAudio } from '../../services/audio-store.js';
import { createBrowserSpeechRecognition } from '../../services/speech-recognition.js';
import { useLocalDay } from '../../hooks/useLocalDay.js';
import InlineRecorder from './InlineRecorder.jsx';

const Recorder = forwardRef(function Recorder(
  {
    record,
    date,
    onClose,
    onSave,
    holdCapture,
    holding = false,
    cancelling = false,
    inline = false,
    voiceGesture,
    focusRequest = 0,
    onStateChange,
  },
  ref,
) {
  const TODAY = useLocalDay();
  const card = record?.cardId ? getCard(record.cardId) : null;
  const [text, setText] = useState(record?.text || '');
  const initialStatus = reviewOptions.some(([id]) => id === record?.status) ? record.status : '';
  const [status, setStatus] = useState(initialStatus);
  const [phase, setPhase] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [asr, setAsr] = useState('');
  const [interim, setInterim] = useState('');
  const [audio, setAudio] = useState(null);
  const [existingAudioUrl, setExistingAudioUrl] = useState('');
  const [draftAudioUrl, setDraftAudioUrl] = useState('');
  const [removeExistingAudio, setRemoveExistingAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const recorderRef = useRef();
  const streamRef = useRef();
  const recognitionRef = useRef();
  const timerRef = useRef();
  const mounted = useRef(true);
  const pendingPermission = useRef(false);
  const audioRef = useRef();
  const discardRef = useRef();
  const draftRef = useRef();
  const autoHoldRecording = useRef(false);
  const recognitionRunning = useRef(false);
  const pendingBlob = useRef();
  const finalizationTimer = useRef();
  const firstSpeechResult = useRef(true);
  const baseline = useRef({ text: record?.text || '', status: initialStatus });
  const holdSnapshot = useRef();
  const operation = useRef(0);
  const leaveAction = useRef();
  const stateCallback = useRef(onStateChange);
  stateCallback.current = onStateChange;
  const audioUrl = removeExistingAudio ? '' : audio ? draftAudioUrl : existingAudioUrl;
  const dirty =
    text !== baseline.current.text ||
    status !== baseline.current.status ||
    Boolean(audio) ||
    removeExistingAudio;
  const active = ['recording', 'paused', 'processing', 'requesting'].includes(phase);
  const finishAudio = () => {
    clearTimeout(finalizationTimer.current);
    const blob = pendingBlob.current;
    if (!mounted.current || !blob) return;
    pendingBlob.current = null;
    setAudio(blob);
    setRemoveExistingAudio(false);
    setInterim('');
    setPhase('finished');
  };
  useEffect(() => {
    if (discard) discardRef.current?.querySelector('button')?.focus();
  }, [discard]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current++;
      clearInterval(timerRef.current);
      clearTimeout(finalizationTimer.current);
      recognitionRef.current?.abort();
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    let live = true;
    let url = '';
    setExistingAudioUrl('');
    if (record?.audioId)
      getAudio(record.audioId)
        .then((blob) => {
          if (blob && live) {
            url = URL.createObjectURL(blob);
            setExistingAudioUrl(url);
          }
        })
        .catch(() => live && setError('原录音暂时无法读取，可以继续补写文字。'));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [record?.audioId]);
  useEffect(() => {
    if (!audio) {
      setDraftAudioUrl('');
      return;
    }
    const url = URL.createObjectURL(audio);
    setDraftAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  useEffect(() => {
    if (phase !== 'recording') return;
    timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);
  useEffect(() => {
    if (!inline || dirty || active) return;
    baseline.current = { text: record?.text || '', status: initialStatus };
    setText(baseline.current.text);
    setStatus(initialStatus);
  }, [record, inline]);
  useEffect(() => {
    stateCallback.current?.({ phase, dirty, active, seconds });
  }, [phase, dirty, active, seconds]);
  useEffect(() => {
    if (!inline || !focusRequest) return;
    draftRef.current?.focus({ preventScroll: true });
    draftRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [focusRequest, inline]);
  useEffect(() => {
    if (!inline || (!dirty && !active)) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [inline, dirty, active]);
  const startRecognition = () => {
    let recognition;
    recognition = createBrowserSpeechRecognition({
      onFinal: (value) => {
        if (!mounted.current || recognitionRef.current !== recognition) return;
        const separator = firstSpeechResult.current;
        firstSpeechResult.current = false;
        setText((previous) => previous + (separator && previous.trim() ? '\n' : '') + value);
      },
      onInterim: (value) => {
        if (mounted.current && recognitionRef.current === recognition) setInterim(value);
      },
      onError: () => {
        if (!mounted.current || recognitionRef.current !== recognition) return;
        recognitionRunning.current = false;
        setAsr('自动转写暂不可用。原声音会保留，也可以补写。');
        finishAudio();
      },
      onEnd: () => {
        if (!mounted.current || recognitionRef.current !== recognition) return;
        recognitionRunning.current = false;
        finishAudio();
      },
    });
    if (!recognition) {
      setAsr('此浏览器不支持自动转写。声音会保留，可以补写一句。');
      return;
    }
    recognitionRef.current = recognition;
    try {
      recognition.start();
      recognitionRunning.current = true;
      setAsr('');
    } catch {
      recognitionRunning.current = false;
      setAsr('转写未连接，录音仍会保留。');
    }
  };
  const start = async (fromHold = false) => {
    if (pendingPermission.current || active || saving) return;
    if (fromHold)
      holdSnapshot.current = { text, audio, removeExistingAudio, seconds, phase, asr, error };
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('此浏览器无法录音，请直接写下一句话。');
      return;
    }
    pendingPermission.current = true;
    const version = ++operation.current;
    autoHoldRecording.current = fromHold === true;
    pendingBlob.current = null;
    firstSpeechResult.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    recognitionRunning.current = false;
    setError('');
    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (
        !mounted.current ||
        version !== operation.current ||
        (fromHold === true && !holdCapture?.held)
      ) {
        stream.getTracks().forEach((track) => track.stop());
        if (mounted.current && version === operation.current) {
          autoHoldRecording.current = false;
          setPhase('idle');
          setError('麦克风已准备好。可以重新录制这一句。');
        }
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (mounted.current && version === operation.current && chunks.length) {
          pendingBlob.current = new Blob(chunks, { type: recorder.mimeType || chunks[0].type });
          if (recognitionRunning.current) finalizationTimer.current = setTimeout(finishAudio, 1200);
          else finishAudio();
        } else if (mounted.current && version === operation.current) {
          setPhase('idle');
          setError((previous) => previous || '没有收到声音，可以重新录一遍，或直接写下来。');
        }
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onerror = () => {
        if (mounted.current && version === operation.current) {
          const recognition = recognitionRef.current;
          recognitionRef.current = null;
          recognitionRunning.current = false;
          recognition?.abort();
          autoHoldRecording.current = false;
          setError('录音被中断。请检查已保留的声音，或重新录制。');
          setPhase('idle');
        }
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      setSeconds(0);
      setAudio(null);
      setPhase('recording');
      recorder.start();
      startRecognition();
    } catch (err) {
      if (!mounted.current || version !== operation.current) return;
      autoHoldRecording.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setPhase('idle');
      setError(
        err.name === 'NotAllowedError'
          ? '麦克风没有开启。允许麦克风后可重试，也可以直接写下来。'
          : '没能连接麦克风。检查设备后重试，或直接写下来。',
      );
    } finally {
      pendingPermission.current = false;
    }
  };
  const stop = () => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
    setPhase('processing');
    autoHoldRecording.current = false;
    recorderRef.current.stop();
    recognitionRef.current?.stop();
  };
  const abortCapture = () => {
    operation.current++;
    autoHoldRecording.current = false;
    clearTimeout(finalizationTimer.current);
    pendingBlob.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognitionRunning.current = false;
    recognition?.abort();
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setInterim('');
  };
  const cancelHold = () => {
    const snapshot = holdSnapshot.current;
    if (!snapshot) return;
    holdSnapshot.current = null;
    abortCapture();
    setText(snapshot.text);
    setAudio(snapshot.audio);
    setRemoveExistingAudio(snapshot.removeExistingAudio);
    setSeconds(snapshot.seconds);
    setPhase(snapshot.phase);
    setAsr(snapshot.asr);
    setError(snapshot.error);
  };
  useEffect(() => {
    if (holdCapture?.held) start(true);
  }, [holdCapture?.id]);
  useEffect(() => {
    if (holdCapture && !holding && holdCapture.cancelled) {
      cancelHold();
      return;
    }
    if (
      holdCapture &&
      !holding &&
      autoHoldRecording.current &&
      ['recording', 'paused'].includes(phase)
    )
      stop();
  }, [holding, phase, holdCapture?.id, holdCapture?.cancelled]);
  const togglePause = () => {
    if (phase === 'recording') {
      recorderRef.current.pause();
      recognitionRef.current?.stop();
      setPhase('paused');
    } else {
      recorderRef.current.resume();
      startRecognition();
      setPhase('recording');
    }
  };
  const resetDraft = () => {
    abortCapture();
    baseline.current = { text: record?.text || '', status: initialStatus };
    setText(baseline.current.text);
    setStatus(initialStatus);
    setAudio(null);
    setRemoveExistingAudio(false);
    setSeconds(0);
    setPhase('idle');
    setError('');
    setAsr('');
    setDiscard(false);
  };
  const close = (action = inline ? resetDraft : onClose) => {
    if (saving || phase === 'processing') return;
    if (dirty || active) {
      if (phase === 'recording' || phase === 'paused') stop();
      if (phase === 'requesting') {
        abortCapture();
        setPhase('idle');
      }
      leaveAction.current = action;
      setDiscard(true);
    } else action();
  };
  useImperativeHandle(ref, () => ({
    requestLeave: close,
    stopRecording: stop,
    canStartHold: () => !pendingPermission.current && !active && !saving && !discard,
  }));
  useEffect(() => {
    if (!inline) return;
    const onKey = (event) => {
      if (document.querySelector('.modal-backdrop')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (discard) {
          setDiscard(false);
          draftRef.current?.focus({ preventScroll: true });
        } else if (dirty || active) close();
      }
      if (event.key !== 'Tab' || !discard) return;
      const buttons = [...discardRef.current.querySelectorAll('button')];
      const first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [inline, discard, dirty, active, phase, saving]);
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    let audioId = removeExistingAudio ? null : record?.audioId || null;
    try {
      if (audio) {
        audioId = `voice-${date}-${Date.now()}`;
        await putAudio(audioId, audio);
      }
      const patch = createReflectionPatch({ text, status, audioId });
      await onSave(patch);
      if (record?.audioId && record.audioId !== audioId)
        deleteAudio(record.audioId).catch(() => {});
      if (inline && mounted.current) {
        baseline.current = { text: text.trim(), status };
        setText(text.trim());
        setAudio(null);
        setRemoveExistingAudio(false);
        setPhase('idle');
        setSaving(false);
        draftRef.current?.blur();
      }
    } catch {
      if (audio && audioId && audioId !== record?.audioId) deleteAudio(audioId).catch(() => {});
      setError('没有保存成功，请保留页面并再试一次。');
      setSaving(false);
    }
  };
  const canSave =
    Boolean(text.trim() || status || audio || (!removeExistingAudio && record?.audioId)) &&
    (!inline || dirty);
  const dayLabel = date === TODAY ? '今天' : date === dayAgo(1) ? '昨天' : shortDate(date);
  const question = card
    ? card.question.replace(/^今天/, dayLabel)
    : `${dayLabel}，有什么值得留下一句？`;
  const discardPrompt = discard && (
    <div
      className="discard-confirm"
      ref={discardRef}
      role="alertdialog"
      aria-modal={inline ? undefined : true}
      aria-label="保留这条记录吗"
    >
      <h3>这一句，还没留好。</h3>
      <p>离开会放弃这次修改。</p>
      <div>
        <button
          className="secondary-button"
          data-cancel-discard
          onClick={() => {
            setDiscard(false);
            draftRef.current?.focus({ preventScroll: true });
          }}
        >
          继续记录
        </button>
        <button
          className="danger-button"
          onClick={() => {
            const action = leaveAction.current;
            resetDraft();
            action?.();
          }}
        >
          放弃并离开
        </button>
      </div>
    </div>
  );
  const removeAudio = () => {
    setAudio(null);
    setRemoveExistingAudio(true);
    setPhase('idle');
  };
  if (inline)
    return (
      <InlineRecorder
        captureSource={holdCapture?.source}
        phase={phase}
        text={text}
        interim={interim}
        seconds={seconds}
        error={error}
        asr={asr}
        audioUrl={audioUrl}
        stream={streamRef.current}
        holding={holding}
        cancelling={cancelling}
        saving={saving}
        dirty={dirty}
        canSave={canSave}
        active={active}
        draftRef={draftRef}
        audioRef={audioRef}
        title={date === TODAY ? '此刻的一句话' : `${dayLabel}的一句话`}
        onTextChange={setText}
        onStart={() => start()}
        onStop={stop}
        onPause={togglePause}
        onRemoveAudio={removeAudio}
        onSave={save}
        onDiscard={() => close()}
        voiceGesture={voiceGesture}
        discardPrompt={discardPrompt}
      />
    );
  return (
    <div className="recorder">
      <div className="modal-heading">
        <span className="eyebrow">{dayLabel}的一句话</span>
        <button
          data-recorder-close
          className="icon-button"
          onClick={() => close()}
          aria-label="关闭记录"
          title="关闭"
          disabled={saving || phase === 'processing'}
        >
          <X size={20} />
        </button>
      </div>
      <div className="record-question">
        {card && <img src={card.image} alt={card.name} />}
        <div>
          {card && (
            <span>
              {card.name} · {card.title}
            </span>
          )}
          <h2>{question}</h2>
        </div>
      </div>
      <div className="review-options" role="group" aria-label="这张牌与你的一天">
        {reviewOptions.map(([id, label]) => (
          <button
            key={id}
            className={status === id ? 'selected' : ''}
            aria-pressed={status === id}
            onClick={() => setStatus(status === id ? '' : id)}
          >
            {status === id && <Check size={13} />}
            {label}
          </button>
        ))}
      </div>
      <div className={`voice-space ${phase}`}>
        <div className="voice-topline">
          <span>
            <span className="record-dot" />
            {phase === 'recording'
              ? '正在听你说'
              : phase === 'paused'
                ? '暂停一下'
                : phase === 'finished'
                  ? '这段声音，留下了'
                  : phase === 'requesting'
                    ? '等待麦克风权限'
                    : phase === 'processing'
                      ? '正在保留声音'
                      : '留一个真实的片刻'}
          </span>
          <span className="timer">
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:
            {String(seconds % 60).padStart(2, '0')}
          </span>
        </div>
        <div className={`waveform ${phase === 'recording' ? 'moving' : ''}`} aria-hidden="true">
          {Array.from({ length: 43 }, (_, i) => (
            <i
              key={i}
              style={{
                '--height': `${8 + ((i * 17 + 13) % 43)}px`,
                '--delay': `${(i % 8) * -0.13}s`,
              }}
            />
          ))}
        </div>
        {['recording', 'paused'].includes(phase) ? (
          <div className="record-actions">
            <button
              className="icon-button"
              onClick={togglePause}
              aria-label={phase === 'paused' ? '继续录音' : '暂停录音'}
            >
              {phase === 'paused' ? <Play size={23} /> : <Pause size={23} />}
            </button>
            <button className="stop-record" onClick={stop} aria-label="结束录音">
              <Square size={20} fill="currentColor" />
            </button>
            <span>{phase === 'paused' ? '继续' : '暂停'} / 结束</span>
          </div>
        ) : (
          <button
            className="start-record"
            onClick={() => start()}
            disabled={active || saving}
            aria-label={phase === 'finished' ? '重新录音' : '开始录音'}
          >
            {phase === 'finished' ? <RotateCcw size={21} /> : <Mic size={23} />}
          </button>
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
      {audioUrl && !removeExistingAudio && !active && (
        <div className="audio-review">
          <audio ref={audioRef} controls src={audioUrl} />
          <button className="icon-button" onClick={removeAudio} aria-label="移除录音">
            <Trash2 size={17} />
          </button>
        </div>
      )}
      <div className="transcript-heading">
        <label htmlFor="journal-text">
          {phase === 'recording' ? '转写中的一句话' : '你的一句话'}
        </label>
        <span>可以自己改一改</span>
      </div>
      <textarea
        ref={draftRef}
        id="journal-text"
        placeholder="刚刚发生了什么？也可以直接写下来。"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={saving}
      />
      {interim && <p className="interim-text">{interim}</p>}
      <div className="record-save-area">
        <button
          className="primary-button save-button"
          disabled={active || saving || !canSave}
          onClick={save}
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
        <p className="record-footer">
          {date === TODAY ? '明天的你，会读到今天。' : '这一句，留给以后的自己。'}
        </p>
      </div>
      {discardPrompt}
    </div>
  );
});

export default Recorder;
