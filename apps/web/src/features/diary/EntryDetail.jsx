import React, { useState, useEffect } from 'react';
import { Leaf, Pencil, Trash2, X } from 'lucide-react';
import { getCard } from '../../domain/cards.js';
import { shortDate } from '../../domain/dates.js';
import { statusNames } from '../../domain/diary.js';
import { getAudio } from '../../services/audio-store.js';

export default function EntryDetail({ record, onClose, onEdit, onDelete }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [audioError, setAudioError] = useState('');
  useEffect(() => {
    let url,
      cancelled = false;
    if (record?.audioId)
      getAudio(record.audioId)
        .then((blob) => {
          if (cancelled) return;
          if (!blob) {
            setAudioError('这段音频暂时无法读取。');
            return;
          }
          url = URL.createObjectURL(blob);
          setAudioUrl(url);
        })
        .catch(() => setAudioError('这段音频暂时无法读取。'));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [record?.audioId]);
  if (!record)
    return (
      <div className="settings-panel">
        <h2>这条记录已移除</h2>
        <button className="primary-button" onClick={onClose}>
          返回回看
        </button>
      </div>
    );
  const card = record.cardId ? getCard(record.cardId) : null;
  return (
    <div className="entry-detail">
      <div className="modal-heading">
        <span className="eyebrow">
          {shortDate(record.date)}
          {record.demo && ' · 示例记录'}
        </span>
        <button className="icon-button" onClick={onClose} aria-label="关闭记录详情">
          <X size={20} />
        </button>
      </div>
      {card && (
        <div className="detail-card-row">
          <img src={card.image} alt={card.name} />
          <div>
            <span className="eyebrow">那天抽到的牌</span>
            <h2>
              {card.name} · {card.title}
            </h2>
            <p>{card.prompt}</p>
          </div>
        </div>
      )}
      <div className="detail-writing">
        <span className={`entry-status ${record.status}`}>
          <Leaf size={14} />
          {statusNames[record.status]}
        </span>
        <p>
          {record.text ||
            (record.audioId ? '有些时刻，声音就足够了。' : '这一天，还在等一句回声。')}
        </p>
      </div>
      {audioUrl && <audio controls src={audioUrl} />}
      {audioError && <p className="record-error">{audioError}</p>}
      <div className="detail-actions">
        <button className="secondary-button" onClick={onEdit}>
          <Pencil size={16} />
          {record.status === 'pending' ? '补上一句话' : '编辑记录'}
        </button>
        <button
          className="icon-button"
          aria-label="删除这条记录"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={18} />
        </button>
      </div>
      {confirmDelete && (
        <div className="delete-confirm">
          <p>删除这一天的牌和记录？删除后无法恢复。</p>
          <button className="text-button" onClick={() => setConfirmDelete(false)}>
            保留
          </button>
          <button className="danger-button" onClick={() => onDelete(record)}>
            删除记录
          </button>
        </div>
      )}
    </div>
  );
}
