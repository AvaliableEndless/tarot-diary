import React, { forwardRef } from 'react';
import { Moon, Sparkles } from 'lucide-react';

const CardBack = forwardRef(function CardBack({ className = '' }, ref) {
  return (
    <span className={`card-back ${className}`} ref={ref}>
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
  );
});

export default CardBack;
