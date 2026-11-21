import React from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { getCard } from '../domain/cards.js';
import { shortDate } from '../domain/dates.js';
import { statusNames } from '../domain/diary.js';

export default function YesterdaySection({ yesterday, skipped, onOpen, onSkip }) {
  return yesterday && !skipped ? (
    <section className="yesterday-section">
      <div className="section-line">
        <h2>
          <RotateCcw size={16} />
          昨天的回声
        </h2>
        <span>{shortDate(yesterday.date)}</span>
      </div>
      <button className="yesterday-row" onClick={() => onOpen(yesterday.date)}>
        {yesterday.cardId && (
          <img src={getCard(yesterday.cardId).image} alt={getCard(yesterday.cardId).name} />
        )}
        <span>
          <small>
            {yesterday.cardId
              ? `${getCard(yesterday.cardId).name} · ${getCard(yesterday.cardId).title}`
              : '昨天的一句话'}
            {yesterday.demo && <span className="sample">示例</span>}
          </small>
          <strong>
            {yesterday.status === 'pending'
              ? yesterday.cardId
                ? getCard(yesterday.cardId).question.replace(/^今天/, '昨天')
                : '昨天，有什么值得留下一句？'
              : yesterday.text || statusNames[yesterday.status]}
          </strong>
        </span>
        <span className="round-arrow">
          <ArrowUpRight size={18} />
        </span>
      </button>
      {yesterday.status === 'pending' && (
        <button className="skip-button" onClick={() => onSkip()}>
          晚点再说
        </button>
      )}
    </section>
  ) : null;
}
