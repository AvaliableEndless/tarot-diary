import React from 'react';
import {
  ArrowRight,
  CheckCheck,
  ChevronRight,
  Feather,
  Grid2X2,
  Mic,
  Moon,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react';
import { getCard } from '../domain/cards.js';

export default function TodayPage({
  card,
  today,
  drawing,
  draw,
  setModal,
  openRecord,
  meaningOpen,
  setMeaningOpen,
  renderYesterday,
  navigate,
}) {
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
        <p className="heading-sub">
          {card ? '把答案留给生活。' : '给平常的一天，一个小小的期待。'}
        </p>
        <button
          className="icon-button mobile-deck"
          onClick={() => navigate('deck')}
          aria-label="打开牌库"
          title="牌库"
        >
          <Grid2X2 size={19} />
        </button>
      </div>
      <section className={`daily-stage ${card ? 'is-drawn' : ''}`} aria-label="今日抽牌">
        <div className={`card-area ${drawing ? 'drawing' : ''}`}>
          {!card ? (
            <button
              className="deck-stack"
              onClick={draw}
              disabled={drawing}
              aria-label="翻开今天的牌"
            >
              <img className="peek-card peek-left" src={getCard(20).image} alt="" />
              <img className="peek-card peek-right" src={getCard(18).image} alt="" />
              <span className="card-back">
                <span className="card-back-border">
                  <span className="deck-top">A MOMENT FOR YOU</span>
                  <span className="deck-symbol">
                    <Moon size={52} strokeWidth={0.8} />
                    <Sparkles size={20} strokeWidth={1} />
                  </span>
                  <span className="deck-name">拾 念</span>
                  <span className="deck-bottom">ONE DAY · ONE CARD</span>
                </span>
              </span>
            </button>
          ) : (
            <button
              className="revealed-card"
              onClick={() => setModal({ type: 'card', cardId: card.id })}
              aria-label={`查看${card.name}牌意`}
            >
              <img src={card.image} alt={`${card.name} · ${card.english}`} />
              <span className="card-zoom">
                <Plus size={14} />
              </span>
            </button>
          )}
          <span className="card-caption">
            {card
              ? `${String(card.number).padStart(2, '0')} / ${card.english.toUpperCase()}`
              : '78 种相遇 · 今天只留一张'}
          </span>
        </div>
        {card ? (
          <div className="card-reading">
            <span className="reading-kicker">
              <span />
              今日的提醒
            </span>
            <h2>
              {card.name}
              <span>·</span>
              {card.title}
            </h2>
            <p className="daily-prompt">{card.prompt}</p>
            <button
              className="text-button meaning-toggle"
              onClick={() => setMeaningOpen(!meaningOpen)}
              aria-expanded={meaningOpen}
            >
              {meaningOpen ? '收起牌意' : '读一读这张牌'}
              <ChevronRight size={14} className={meaningOpen ? 'turn-down' : ''} />
            </button>
            {meaningOpen && <p className="meaning-detail">{card.detail}</p>}
            <div className="saved-card-label">
              <CheckCheck size={15} />
              今天的牌，已为你留好
            </div>
            <button className="primary-button today-record-button" onClick={() => openRecord()}>
              <Mic size={17} />
              {today?.text || today?.audioId ? '再看看今天的一句话' : '现在想留一句'}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="draw-action">
            <button className="primary-button draw-button" onClick={draw} disabled={drawing}>
              {drawing ? (
                <>
                  <Sparkles size={17} />
                  正在遇见今天…
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
