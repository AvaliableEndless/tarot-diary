import React, { useState, useEffect, useRef } from 'react';
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
import { hasReflection } from '../domain/diary.js';
import { useDiary } from '../hooks/useDiary.js';
import { useLocalDay } from '../hooks/useLocalDay.js';
import Modal from '../components/Modal.jsx';
import RecordListItem from '../components/RecordListItem.jsx';
import YesterdaySection from '../components/YesterdaySection.jsx';
import TodayPage from '../pages/TodayPage.jsx';
import HistoryPage from '../pages/HistoryPage.jsx';
import DeckPage from '../pages/DeckPage.jsx';
import Recorder from '../features/diary/Recorder.jsx';
import EntryDetail from '../features/diary/EntryDetail.jsx';
import Settings from '../features/diary/Settings.jsx';
import CardDetail from '../features/cards/CardDetail.jsx';
const query = new URLSearchParams(location.search);
const PREVIEW = query.get('preview');

export default function App() {
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
  const [drawing, setDrawing] = useState(false);
  const [meaningOpen, setMeaningOpen] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [month, setMonth] = useState(new Date(`${TODAY.slice(0, 7)}-01T12:00:00`));
  const [selectedDay, setSelectedDay] = useState(null);
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('all');
  const toastTimer = useRef();
  const drawTimer = useRef();
  const today = records.find((record) => record.date === TODAY);
  const yesterday = records.find((record) => record.date === dayAgo(1));
  const card = today?.cardId ? getCard(today.cardId) : null;
  const completed = records.filter(hasReflection);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(drawTimer.current);
    },
    [],
  );
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };
  const navigate = (target) => {
    setTab(target);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const draw = () => {
    if (card || drawing) return;
    setDrawing(true);
    drawTimer.current = setTimeout(
      () => {
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        try {
          updateRecord(TODAY, { cardId: cards[random[0] % cards.length].id, demo: false });
          if (navigator.vibrate) navigator.vibrate(30);
        } catch {
          notify('今天的牌没有保存成功，请检查浏览器存储后重试');
        }
        setDrawing(false);
        setMeaningOpen(false);
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650,
    );
  };
  const openRecord = (date = TODAY) => setModal({ type: 'record', date });
  const removeRecord = async (record) => {
    try {
      deleteRecord(record.id);
    } catch {
      notify('记录没有删除成功，请稍后再试');
      return;
    }
    // Delete text first so a failed text write cannot leave a record pointing at deleted audio.
    if (record.audioId)
      deleteAudio(record.audioId).catch(() => notify('记录已删除，音频清理稍后重试'));
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
      skipped={skipped}
      onOpen={openRecord}
      onSkip={() => setSkipped(true)}
    />
  );

  return (
    <>
      <div className={`app-shell ${PREVIEW ? 'preview-shell' : ''}`}>
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
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => navigate(id)}>
                <Icon size={16} />
                {name}
              </button>
            ))}
          </nav>
          <button
            className="icon-button settings-button"
            aria-label="设置与数据"
            title="设置与数据"
            onClick={() => setModal({ type: 'settings' })}
          >
            <Settings2 size={20} />
          </button>
        </header>
        {storageError && (
          <p className="storage-warning" role="alert">
            记录暂时无法读取或保存。已有数据未被覆盖，请检查浏览器存储后重试。
          </p>
        )}
        <div className={`workspace ${tab === 'deck' ? 'deck-workspace' : ''}`}>
          <main className={`main-content ${tab}`}>
            {tab === 'today' && (
              <TodayPage
                card={card}
                today={today}
                drawing={drawing}
                draw={draw}
                setModal={setModal}
                openRecord={openRecord}
                meaningOpen={meaningOpen}
                setMeaningOpen={setMeaningOpen}
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
          {tab !== 'deck' && (
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
          <button className={tab === 'today' ? 'active' : ''} onClick={() => navigate('today')}>
            <Sun size={22} strokeWidth={1.6} />
            <span>今天</span>
          </button>
          <button
            className="capture-nav"
            onClick={() => openRecord()}
            aria-label="留一句，打开录音"
          >
            <span>
              <Mic size={23} strokeWidth={1.7} />
            </span>
            <small>留一句</small>
          </button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => navigate('history')}>
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
      {modal && (
        <Modal onClose={() => setModal(null)}>
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
              onClearDemo={() => {
                clearDemo();
                notify('示例记录已清除');
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}
