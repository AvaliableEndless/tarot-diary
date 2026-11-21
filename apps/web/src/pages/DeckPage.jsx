import React from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { cards } from '../domain/cards.js';

export default function DeckPage({ setModal, search, setSearch, family, setFamily }) {
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">THE COLLECTION</p>
        <h1>78 张牌，78 次相遇。</h1>
        <p className="heading-sub">每张牌，都有一个看待日常的角度。</p>
      </div>
      <div className="deck-controls">
        <label className="search-field">
          <Search size={17} />
          <input
            placeholder="找一张牌"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="搜索牌名"
          />
          {search && (
            <button className="icon-button" aria-label="清除搜索" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </label>
        <div className="family-tabs" role="tablist" aria-label="牌组分类">
          {[
            ['all', '全部'],
            ['major', '大牌'],
            ['wands', '权杖'],
            ['cups', '圣杯'],
            ['swords', '宝剑'],
            ['pentacles', '星币'],
          ].map(([id, name]) => (
            <button
              key={id}
              role="tab"
              aria-selected={family === id}
              className={family === id ? 'active' : ''}
              onClick={() => setFamily(id)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="collection-grid">
        {cards
          .filter(
            (item) =>
              (family === 'all' || item.suit === family) &&
              `${item.name} ${item.english}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((item) => (
            <button
              className="collection-card"
              key={item.id}
              onClick={() => setModal({ type: 'card', cardId: item.id })}
            >
              <img src={item.image} alt={item.name} loading="lazy" />
              <strong>{item.name}</strong>
              <small>{item.title}</small>
            </button>
          ))}
      </div>
      {cards.filter(
        (item) =>
          (family === 'all' || item.suit === family) &&
          `${item.name} ${item.english}`.toLowerCase().includes(search.toLowerCase()),
      ).length === 0 && (
        <div className="empty-day">
          <Search size={24} />
          <p>没有找到这张牌</p>
          <button
            className="text-button"
            onClick={() => {
              setSearch('');
              setFamily('all');
            }}
          >
            看看所有的牌
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
