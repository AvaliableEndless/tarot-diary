import React from 'react';
import { Check, ChevronRight, Leaf, Mic } from 'lucide-react';
import { getCard } from '../domain/cards.js';
import { shortDate } from '../domain/dates.js';
import { statusNames } from '../domain/diary.js';

export default function RecordListItem({ record, compact = false, onOpen }) {
  const item = record.cardId ? getCard(record.cardId) : null;
  return (
    <button
      className={`entry ${compact ? 'compact' : ''}`}
      key={record.id}
      onClick={() => onOpen(record.date)}
    >
      {item ? (
        <img src={item.image} alt={item.name} loading="lazy" />
      ) : (
        <span className="entry-no-card">
          <Mic size={20} />
        </span>
      )}
      <span className="entry-content">
        <span className="entry-date">
          {shortDate(record.date)}
          <span className="dot">·</span>
          {item?.name || '一句记录'}
          {record.demo && <small className="sample">示例</small>}
        </span>
        <span className="entry-text">
          {record.text ||
            (record.audioId ? '留了一段声音，等待补上一句话。' : statusNames[record.status])}
        </span>
        {!compact && (
          <span className={`entry-status ${record.status}`}>
            {record.status === 'yes' ? <Check size={12} /> : <Leaf size={12} />}
            {statusNames[record.status]}
          </span>
        )}
      </span>
      <ChevronRight className="entry-arrow" size={17} />
    </button>
  );
}
