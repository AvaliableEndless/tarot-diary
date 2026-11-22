import React, { useRef } from 'react';
import {
  ArrowRight,
  ChevronsRight,
  Feather,
  Grid2X2,
  Info,
  Mic,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { getCard } from '../domain/cards.js';
import CardBack from '../features/cards/CardBack.jsx';
import HoldToRecordButton from '../components/HoldToRecordButton.jsx';

export default function TodayPage({
  card,
  today,
  drawing,
  replaying,
  motionMode,
  voiceGesture,
  drawPhase,
  drawTarget,
  skipDraw,
  draw,
  setModal,
  openRecord,
  renderYesterday,
  navigate,
}) {
  const deckFace = useRef();
  const startDraw = () => draw(deckFace.current?.getBoundingClientRect());
  const drawLabel = {
    loading: '正在准备今天的牌…',
    shuffle: '轻轻洗牌…',
    reveal: '正在翻开…',
    landing: '今天的牌，留好了',
  }[drawPhase];
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">
          {new Date().toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
          <span className="tiny-line" />
          一日一牌
        </p>
        <h1>{card ? '这一张，属于今天。' : '今天，会有什么发生？'}</h1>
        {!card && <p className="heading-sub">给平常的一天，一个小小的期待。</p>}
        <button
          className="icon-button mobile-deck"
          onClick={() => navigate('deck')}
          aria-label="打开牌库"
          title="牌库"
        >
          <Grid2X2 size={19} />
        </button>
      </div>
      <section
        className={`daily-stage motion-${motionMode} ${card ? 'is-drawn' : ''} ${replaying ? 'draw-replay' : ''} ${drawPhase === 'landing' ? 'draw-landing' : ''}`}
        aria-label="今日抽牌"
        aria-busy={drawing}
      >
        <p className="sr-only" role="status" aria-live="polite">
          {card
            ? `今天的牌：${card.name}。${card.symbols.join('、')}。${card.todayHint}`
            : drawing
              ? drawLabel
              : ''}
        </p>
        <div className={`card-area ${drawing ? `drawing draw-${drawPhase}` : ''}`}>
          {!card ? (
            <button
              className="deck-stack"
              onClick={startDraw}
              disabled={drawing}
              aria-label="翻开今天的牌"
            >
              <img
                className="peek-card peek-left"
                src={getCard(20).image}
                alt=""
                width="360"
                height="600"
                fetchPriority="high"
              />
              <img
                className="peek-card peek-right"
                src={getCard(18).image}
                alt=""
                width="360"
                height="600"
              />
              <CardBack ref={deckFace} />
            </button>
          ) : (
            <button
              className="revealed-card"
              ref={drawTarget}
              onClick={() => setModal({ type: 'card', cardId: card.id })}
              aria-label={`查看${card.name}牌意`}
            >
              <img
                src={card.image}
                alt={`${card.name} · ${card.english}`}
                width="360"
                height="600"
                fetchPriority="high"
              />
              <span className="card-zoom">
                <Plus size={14} />
              </span>
            </button>
          )}
          {!card && <span className="card-caption">78 种相遇 · 今天只留一张</span>}
          {drawing && drawPhase !== 'landing' && (
            <button
              className="text-button skip-draw"
              onClick={skipDraw}
              aria-label="跳过抽卡动画"
              title="跳过抽卡动画"
            >
              <ChevronsRight size={17} />
              跳过
            </button>
          )}
        </div>
        {card ? (
          <div className="card-reading">
            <div className="card-reading-heading">
              <h2>{card.name}</h2>
              <div className="card-tools">
                <button
                  className="icon-button"
                  aria-label={`查看${card.name}牌义与来源`}
                  title="牌义与来源"
                  onClick={() => setModal({ type: 'card', cardId: card.id })}
                >
                  <Info size={17} />
                </button>
                <button
                  className="icon-button replay-draw"
                  aria-label="重播抽牌"
                  title="播放完整抽牌动画，不会重抽"
                  disabled={drawing}
                  onClick={() => draw(drawTarget.current?.getBoundingClientRect(), true)}
                >
                  <RotateCcw size={17} />
                </button>
              </div>
            </div>
            <p className="card-symbols">
              <span>常见象征</span>
              {card.symbols.join(' · ')}
            </p>
            <p className="daily-prompt">{card.todayHint}</p>
            <HoldToRecordButton
              className="primary-button today-record-button"
              {...voiceGesture}
              aria-label={`${today?.text || today?.audioId ? '查看今天的记录' : '留一句'}，按住说话`}
            >
              <Mic size={17} />
              {today?.text || today?.audioId ? '查看今天的记录' : '留一句'}
              <ArrowRight size={16} />
            </HoldToRecordButton>
          </div>
        ) : (
          <div className="draw-action">
            <button className="primary-button draw-button" onClick={startDraw} disabled={drawing}>
              {drawing ? (
                <>
                  <Sparkles size={17} />
                  {drawLabel}
                </>
              ) : (
                <>
                  翻开今天的牌
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <span>愿今天，有一个值得记住的瞬间。</span>
          </div>
        )}
      </section>
      <div className="mobile-yesterday">{renderYesterday()}</div>
      {today?.text && (
        <section className="today-quote">
          <div className="section-line">
            <h2>
              <Feather size={15} />
              今天的一句话
            </h2>
            <button
              className="text-button"
              onClick={() => openRecord()}
              aria-label="编辑今天的一句话"
            >
              <Pencil size={15} />
            </button>
          </div>
          <p>{today.text}</p>
        </section>
      )}
    </>
  );
}
