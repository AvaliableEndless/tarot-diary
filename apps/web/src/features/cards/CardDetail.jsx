import React from 'react';
import { X } from 'lucide-react';

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
      <p className="eyebrow">{card.english.toUpperCase()}</p>
      <h2>
        {card.name}
        <span> · {card.title}</span>
      </h2>
      <p className="card-detail-prompt">{card.prompt}</p>
      <p>{card.detail}</p>
      <div className="question-band">
        <span>带着这个问题过今天</span>
        <strong>{card.question}</strong>
      </div>
    </div>
  );
}
