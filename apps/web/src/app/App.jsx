import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  Check,
  Feather,
  Grid2X2,
  Mic,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
} from 'lucide-react';
import { cards, getCard } from '../domain/cards.js';
import { dayAgo, parseDate, shortDate } from '../domain/dates.js';
import { deleteAudio } from '../services/audio-store.js';
import { hasReflection, getAudioIds } from '../domain/diary.js';
import { useDiary } from '../hooks/useDiary.js';
import { useLocalDay } from '../hooks/useLocalDay.js';
import { useViewportMetrics } from '../hooks/useViewportMetrics.js';
import { useMotionPreference } from '../hooks/useMotionPreference.js';
import HoldToRecordButton from '../components/HoldToRecordButton.jsx';
import Modal from '../components/Modal.jsx';
import RecordListItem from '../components/RecordListItem.jsx';
import YesterdaySection from '../components/YesterdaySection.jsx';
import TodayPage from '../pages/TodayPage.jsx';
import HistoryPage from '../pages/HistoryPage.jsx';
import DeckPage from '../pages/DeckPage.jsx';
import DrawMotion from '../features/cards/DrawMotion.jsx';
const loadRecorder = () => import('../features/diary/Recorder.jsx');
const Recorder = lazy(loadRecorder);
const EntryDetail = lazy(() => import('../features/diary/EntryDetail.jsx'));
const Settings = lazy(() => import('../features/diary/Settings.jsx'));
const CardDetail = lazy(() => import('../features/cards/CardDetail.jsx'));
const query = new URLSearchParams(location.search);
const PREVIEW = query.get('preview');

export default function App() {
  useViewportMetrics();
  const motion = useMotionPreference();
  const TODAY = useLocalDay();
  const {
    records,
    storageError,
    updateRecord,
    removeRecord: deleteRecord,
    clearDemo,
  } = useDiary(PREVIEW);
  const [tab, setTab] = useState(PREVIEW === 'history' ? 'history' : 'today');
  const [modal, setModal] = useState(
    PREVIEW === 'record' ? { type: 'record', date: dayAgo(1) } : null,
  );
  const [toast, setToast] = useState('');
  const [drawSession, setDrawSession] = useState(null);
  const [holdSession, setHoldSession] = useState(null);
  const [voiceState, setVoiceState] = useState({
    phase: 'idle',
    dirty: false,
    active: false,
    seconds: 0,
  });
  const [inlineDate, setInlineDate] = useState(TODAY);
  const [focusRequest, setFocusRequest] = useState(0);
  const [skippedDay, setSkippedDay] = useState(null);
  const [month, setMonth] = useState(new Date(`${TODAY.slice(0, 7)}-01T12:00:00`));
  const [selectedDay, setSelectedDay] = useState(null);
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('all');
  const toastTimer = useRef();
  const drawLock = useRef(false);
  const drawTarget = useRef();
  const holdCapture = useRef();
  const holdSequence = useRef(0);
  const inlineVoice = useRef();
  const today = records.find((record) => record.date === TODAY);
  const yesterday = records.find((record) => record.date === dayAgo(1));
  const card = today?.cardId ? getCard(today.cardId) : null;
  const drawing = Boolean(drawSession);
  const visibleCard =
    drawing && !drawSession.replay && drawSession.phase !== 'landing' ? null : card;
  const holding = Boolean(holdSession?.held);
  const completed = records.filter(hasReflection);
  useEffect(() => {
    if (!voiceState.dirty && !voiceState.active && !holding) setInlineDate(TODAY);
  }, [TODAY, voiceState.dirty, voiceState.active, holding]);
  useEffect(() => {
    if (modal) inlineVoice.current?.stopRecording();
  }, [modal]);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
    },
    [],
  );
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };
  const navigate = (target) => {
    if (holding) return;
    const leave = () => {
      finishDraw();
      if (target !== tab) setVoiceState({ phase: 'idle', dirty: false, active: false, seconds: 0 });
      setTab(target);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    if (tab === 'today' && target !== tab && inlineVoice.current)
      inlineVoice.current.requestLeave(leave);
    else leave();
  };
  const finishDraw = () => {
    drawLock.current = false;
    setDrawSession(null);
  };
  useEffect(() => {
    if (drawSession && (drawSession.date !== TODAY || modal || tab !== 'today')) finishDraw();
  }, [TODAY, modal, tab, drawSession?.date]);
  const draw = (origin, replay = false) => {
    if ((!replay && card) || (replay && !card) || drawLock.current) return;
    drawLock.current = true;
    try {
      let chosen = card;
      if (!replay) {
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const saved = updateRecord(TODAY, {
          cardId: cards[random[0] % cards.length].id,
          demo: false,
        });
        chosen = getCard(saved.find((record) => record.date === TODAY).cardId);
      }
      if (navigator.vibrate) navigator.vibrate(20);
      if (!origin?.width) {
        finishDraw();
        return;
      }
      setDrawSession({
        date: TODAY,
        card: chosen,
        motion: replay ? 'full' : motion.mode,
        followSystem: !replay && motion.preference === 'system',
        replay,
        phase: 'loading',
        origin: { left: origin.left, top: origin.top, width: origin.width, height: origin.height },
      });
    } catch {
      finishDraw();
      notify('今天的牌没有保存成功，请检查浏览器存储后重试');
    }
  };
  const openRecord = (date = TODAY) => {
    if (holding) return;
    finishDraw();
    if (date === TODAY) {
      if (inlineDate !== TODAY && voiceState.dirty) {
        notify('请先留好上一天的这一句');
        return;
      }
      setModal(null);
      setTab('today');
      setFocusRequest((value) => value + 1);
    } else {
      inlineVoice.current?.stopRecording();
      setModal({ type: 'record', date });
    }
  };
  const startHold = ({ source } = {}) => {
    if (modal || holdCapture.current?.held || inlineVoice.current?.canStartHold() === false)
      return false;
    if (inlineDate !== TODAY && voiceState.dirty) {
      notify('请先留好上一天的这一句');
      return false;
    }
    finishDraw();
    const capture = { id: ++holdSequence.current, held: true, cancelled: false, source };
    holdCapture.current = capture;
    setTab('today');
    setHoldSession(capture);
    return true;
  };
  const moveHold = (cancelled) => {
    const capture = holdCapture.current;
    if (!capture?.held) return;
    capture.cancelled = cancelled;
    setHoldSession({ ...capture });
  };
  const endHold = (cancelled) => {
    const capture = holdCapture.current;
    if (!capture?.held) return;
    capture.held = false;
    capture.cancelled = cancelled;
    setHoldSession({ ...capture });
  };
  const voiceGesture = {
    onTap: () => openRecord(),
    onHoldStart: startHold,
    onHoldMove: moveHold,
    onHoldEnd: endHold,
    preload: loadRecorder,
  };
  const removeRecord = async (record) => {
    try {
      deleteRecord(record.id);
    } catch {
      notify('记录没有删除成功，请稍后再试');
      return;
    }
    // Delete text first so a failed text write cannot leave a record pointing at deleted audio.
    Promise.all(getAudioIds(record).map(deleteAudio)).catch(() =>
      notify('记录已删除，音频清理稍后重试'),
    );
    setModal(null);
    notify('这条记录已删除');
  };

  const renderEntry = (record, compact = false) => (
    <RecordListItem
      key={record.id}
      record={record}
      compact={compact}
      onOpen={(date) => setModal({ type: 'detail', date })}
    />
  );
  const renderYesterday = () => (
    <YesterdaySection
      yesterday={yesterday}
      skipped={skippedDay === TODAY}
      onOpen={openRecord}
      onSkip={() => setSkippedDay(TODAY)}
    />
  );

  return (
    <>
      <div
        className={`app-shell ${PREVIEW ? 'preview-shell' : ''} ${voiceState.active ? 'voice-active' : ''}`}
        inert={modal ? '' : undefined}
        aria-hidden={modal ? true : undefined}
        data-motion-mode={motion.mode}
        data-system-motion={motion.systemReduced ? 'reduced' : 'full'}
      >
        <header className="app-header">
          <button className="wordmark" onClick={() => navigate('today')} aria-label="拾念首页">
            <span className="brand-mark">
              <Sparkles size={19} strokeWidth={1.5} />
            </span>
            <span>
              拾念<small>SHINIAN</small>
            </span>
          </button>
          <nav className="desktop-nav" aria-label="主导航">
            {[
              ['today', '今天', Sun],
              ['history', '回看', RotateCcw],
              ['deck', '牌库', Grid2X2],
            ].map(([id, name, Icon]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={16} />
                {name}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <HoldToRecordButton
              source="desktop-header"
              className="primary-button desktop-capture"
              aria-label="留一句，按住说话"
              {...voiceGesture}
            >
              <Mic size={17} />
              留一句
            </HoldToRecordButton>
            <button
              className="icon-button settings-button"
              aria-label="设置与数据"
              title="设置与数据"
              disabled={holding}
              onClick={() => {
                inlineVoice.current?.stopRecording();
                setModal({ type: 'settings' });
              }}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </header>
        {storageError && (
          <p className="storage-warning" role="alert">
            记录暂时无法读取或保存。已有数据未被覆盖，请检查浏览器存储后重试。
          </p>
        )}
        <div className={`workspace ${tab}-workspace`}>
          <main className={`main-content ${tab}`}>
            {tab === 'today' && (
              <TodayPage
                card={visibleCard}
                drawing={drawing}
                recording={voiceState.active}
                replaying={Boolean(drawSession?.replay)}
                motionMode={drawSession?.motion || motion.mode}
                drawPhase={drawSession?.phase}
                drawTarget={drawTarget}
                skipDraw={finishDraw}
                draw={draw}
                setModal={setModal}
                journal={
                  <Suspense
                    fallback={
                      <div className="inline-loading" role="status">
                        正在准备记录…
                      </div>
                    }
                  >
                    <Recorder
                      key={inlineDate}
                      ref={inlineVoice}
                      inline
                      date={inlineDate}
                      record={records.find((record) => record.date === inlineDate)}
                      holdCapture={holdSession}
                      holding={holding}
                      cancelling={Boolean(holdSession?.cancelled)}
                      voiceGesture={voiceGesture}
                      focusRequest={focusRequest}
                      onStateChange={setVoiceState}
                      onSave={async (patch) => {
                        updateRecord(inlineDate, patch);
                        notify('这一刻，留好了');
                      }}
                    />
                  </Suspense>
                }
                renderYesterday={renderYesterday}
                navigate={navigate}
              />
            )}
            {tab === 'history' && (
              <HistoryPage
                TODAY={TODAY}
                openRecord={openRecord}
                records={records}
                completed={completed}
                month={month}
                setMonth={setMonth}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                renderEntry={renderEntry}
              />
            )}
            {tab === 'deck' && (
              <DeckPage
                setModal={setModal}
                search={search}
                setSearch={setSearch}
                family={family}
                setFamily={setFamily}
              />
            )}
          </main>
          {tab === 'today' && (
            <aside className="side-content">
              <div className="side-date">
                <Sun size={19} strokeWidth={1.3} />
                <span>ONE DAY, ONE LITTLE THING</span>
              </div>
              {tab === 'today' && renderYesterday()}
              <section className="week-section">
                <div className="section-line">
                  <h2>这一周</h2>
                  <span>
                    {completed.filter((record) => record.date >= dayAgo(6)).length} 次回声
                  </span>
                </div>
                <div className="week-strip">
                  {Array.from({ length: 7 }, (_, i) => {
                    const key = dayAgo(6 - i);
                    const record = records.find((item) => item.date === key);
                    return (
                      <button
                        key={key}
                        className={`${record && record.status !== 'pending' ? 'done' : ''} ${key === TODAY ? 'current' : ''}`}
                        onClick={() => {
                          setMonth(new Date(`${key.slice(0, 7)}-01T12:00:00`));
                          setSelectedDay(key);
                          navigate('history');
                        }}
                        aria-label={`查看${shortDate(key)}记录`}
                      >
                        <small>
                          {['日', '一', '二', '三', '四', '五', '六'][parseDate(key).getDay()]}
                        </small>
                        <span>
                          {record && record.status !== 'pending' ? (
                            <Check size={15} />
                          ) : (
                            parseDate(key).getDate()
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="recent-side">
                <div className="section-line">
                  <h2>留下来的片刻</h2>
                  <button
                    className="text-button"
                    onClick={() => navigate('history')}
                    aria-label="查看所有记录"
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                {[...completed]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 3)
                  .map((record) => renderEntry(record, true))}
              </section>
              <div className="side-footer">
                <Feather size={22} strokeWidth={1} />
                <p>
                  一天一张牌。
                  <br />
                  一天一句话。
                </p>
                <span>不用特别，也值得记得。</span>
              </div>
            </aside>
          )}
        </div>
        <nav className="bottom-nav" aria-label="底部导航">
          <button
            className={tab === 'today' ? 'active' : ''}
            aria-current={tab === 'today' ? 'page' : undefined}
            onClick={() => navigate('today')}
          >
            <Sun size={22} strokeWidth={1.6} />
            <span>今天</span>
          </button>
          <HoldToRecordButton
            source="mobile-nav"
            className="capture-nav"
            {...voiceGesture}
            aria-label="按住说话"
          >
            <span>
              <Mic size={23} strokeWidth={1.7} />
            </span>
            <small>
              {holding ? (holdSession.cancelled ? '松开取消' : '松开结束') : '按住说话'}
            </small>
          </HoldToRecordButton>
          <button
            className={tab === 'history' ? 'active' : ''}
            aria-current={tab === 'history' ? 'page' : undefined}
            onClick={() => navigate('history')}
          >
            <RotateCcw size={22} strokeWidth={1.6} />
            <span>回看</span>
          </button>
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {drawSession && (
        <DrawMotion
          session={drawSession}
          targetRef={drawTarget}
          onPhase={(phase) => setDrawSession((current) => (current ? { ...current, phase } : null))}
          onDone={finishDraw}
          onImageError={() => notify('牌已保存，牌图暂未加载。可以稍后再看。')}
        />
      )}
      {modal && (
        <Modal onClose={() => setModal(null)}>
          <Suspense
            fallback={
              <div className="dialog-loading" role="status">
                正在打开…
              </div>
            }
          >
            {modal.type === 'record' ? (
              <Recorder
                record={records.find((record) => record.date === modal.date)}
                date={modal.date}
                onClose={() => setModal(null)}
                onSave={async (patch) => {
                  updateRecord(modal.date, patch);
                  setModal(null);
                  notify('这一刻，留好了');
                }}
              />
            ) : modal.type === 'card' ? (
              <CardDetail card={getCard(modal.cardId)} onClose={() => setModal(null)} />
            ) : modal.type === 'detail' ? (
              <EntryDetail
                record={records.find((record) => record.date === modal.date)}
                onClose={() => setModal(null)}
                onEdit={() => openRecord(modal.date)}
                onDelete={removeRecord}
              />
            ) : (
              <Settings
                records={records}
                onClose={() => setModal(null)}
                notify={notify}
                motionPreference={motion.preference}
                motionMode={motion.mode}
                onMotionChange={(value) => {
                  const saved = motion.setPreference(value);
                  if (!saved) notify('动效已切换，本次设置未能保存');
                }}
                onClearDemo={() => {
                  clearDemo();
                  notify('示例记录已清除');
                }}
              />
            )}
          </Suspense>
        </Modal>
      )}
    </>
  );
}
