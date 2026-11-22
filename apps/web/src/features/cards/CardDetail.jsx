import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { symbolismSource } from '../../domain/cards.js';

export default function CardDetail({ card, onClose }) {
  return (
    <div className="card-detail">
      <div className="modal-heading">
        <span className="eyebrow">{card.family}</span>
        <button className="icon-button" onClick={onClose} aria-label="关闭牌意">
          <X size={20} />
        </button>
      </div>
      <img src={card.image} alt={card.name} />
      <h2>{card.name}</h2>
      <section className="detail-symbolism">
        <h3>常见象征</h3>
        <p>{card.symbols.join(' · ')}</p>
        <a href={card.meaningSource} target="_blank" rel="noopener noreferrer">
          {symbolismSource.name} · 正位释义
          <ExternalLink size={12} />
        </a>
      </section>
      <section className="detail-reflection">
        <h3>今日联想</h3>
        <p className="card-detail-prompt">{card.todayHint}</p>
        <p>{card.detail}</p>
      </section>
    </div>
  );
}
