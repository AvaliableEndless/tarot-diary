import React, { useRef } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { cards } from '../domain/cards.js';

export default function DeckPage({ setModal, search, setSearch, family, setFamily }) {
  const searchRef = useRef();
  const families = [
    ['all', '全部'],
    ['major', '大牌'],
    ['wands', '权杖'],
    ['cups', '圣杯'],
    ['swords', '宝剑'],
    ['pentacles', '星币'],
  ];
  const visibleCards = cards.filter(
    (item) =>
      (family === 'all' || item.suit === family) &&
      `${item.name} ${item.english}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const moveTab = (event) => {
    const current = families.findIndex(([id]) => id === family);
    let index;
    if (event.key === 'ArrowRight') index = (current + 1) % families.length;
    else if (event.key === 'ArrowLeft') index = (current + families.length - 1) % families.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = families.length - 1;
    else return;
    event.preventDefault();
    setFamily(families[index][0]);
    const next = event.currentTarget.querySelectorAll('[role="tab"]')[index];
    next.focus();
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
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
            ref={searchRef}
            type="search"
            placeholder="找一张牌"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="搜索牌名"
          />
          {search && (
            <button
              className="icon-button"
              aria-label="清除搜索"
              title="清除搜索"
              onClick={() => {
                setSearch('');
                searchRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <div className="family-tabs" role="tablist" aria-label="牌组分类" onKeyDown={moveTab}>
          {families.map(([id, name]) => (
            <button
              key={id}
              role="tab"
              id={`family-${id}`}
              aria-controls="deck-results"
              tabIndex={family === id ? 0 : -1}
              aria-selected={family === id}
              className={family === id ? 'active' : ''}
              onClick={() => setFamily(id)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <p className="result-count" aria-live="polite">
        {visibleCards.length} 张牌
      </p>
      <div
        className="collection-grid"
        role="tabpanel"
        id="deck-results"
        aria-labelledby={`family-${family}`}
      >
        {visibleCards.map((item) => (
          <button
            className="collection-card"
            key={item.id}
            onClick={() => setModal({ type: 'card', cardId: item.id })}
          >
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              decoding="async"
              width="360"
              height="600"
            />
            <strong>{item.name}</strong>
            <small>{item.title}</small>
          </button>
        ))}
      </div>
      {visibleCards.length === 0 && (
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
