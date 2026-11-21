import React from 'react';
import { ChevronLeft, ChevronRight, Leaf, Plus, X } from 'lucide-react';
import { dateKey, parseDate, shortDate } from '../domain/dates.js';

export default function HistoryPage({
  TODAY,
  openRecord,
  records,
  completed,
  month,
  setMonth,
  selectedDay,
  setSelectedDay,
  renderEntry,
}) {
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">THE DAYS YOU LIVED</p>
        <h1>日子，慢慢有了回声。</h1>
        <p className="heading-sub">{completed.length} 个留下来的片刻</p>
      </div>
      <section className="calendar-section">
        <div className="calendar-header">
          <h2>
            {month.getFullYear()} 年 {month.getMonth() + 1} 月
          </h2>
          <div>
            <button
              className="icon-button"
              aria-label="上个月"
              onClick={() => {
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
                setSelectedDay(null);
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setMonth(new Date(`${TODAY.slice(0, 7)}-01T12:00:00`));
                setSelectedDay(TODAY);
              }}
            >
              今天
            </button>
            <button
              className="icon-button"
              aria-label="下个月"
              disabled={
                month.getFullYear() === parseDate(TODAY).getFullYear() &&
                month.getMonth() === parseDate(TODAY).getMonth()
              }
              onClick={() => {
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
                setSelectedDay(null);
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
            <span className="weekday" key={label}>
              {label}
            </span>
          ))}
          {Array.from(
            { length: (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7 },
            (_, i) => (
              <span className="calendar-spacer" key={`blank-${i}`} />
            ),
          )}
          {Array.from(
            { length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() },
            (_, i) => {
              const key = dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1));
              const record = records.find((item) => item.date === key);
              const done = record && (record.status !== 'pending' || record.text || record.audioId);
              return (
                <button
                  key={key}
                  aria-label={`${shortDate(key)}${record ? (done ? '，已记录' : '，已抽牌') : ''}`}
                  aria-pressed={selectedDay === key}
                  disabled={key > TODAY}
                  className={`calendar-day ${done ? 'has-record' : record?.cardId ? 'has-card' : ''} ${key === TODAY ? 'is-today' : ''} ${selectedDay === key ? 'selected' : ''}`}
                  onClick={() => setSelectedDay(selectedDay === key ? null : key)}
                >
                  <span>{i + 1}</span>
                  <i />
                </button>
              );
            },
          )}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="legend-record" />
            留了一句话
          </span>
          <span>
            <i className="legend-card" />
            抽了一张牌
          </span>
        </div>
      </section>
      <section className="history-section">
        <div className="section-line">
          <h2>{selectedDay ? `${shortDate(selectedDay)}的片刻` : '最近的片刻'}</h2>
          {selectedDay && (
            <button className="text-button" onClick={() => setSelectedDay(null)}>
              查看全部
              <X size={13} />
            </button>
          )}
        </div>
        {records
          .filter((record) => !selectedDay || record.date === selectedDay)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((record) => renderEntry(record))}
        {selectedDay && !records.some((record) => record.date === selectedDay) && (
          <div className="empty-day">
            <Leaf size={26} strokeWidth={1} />
            <p>这一天，安静地经过了。</p>
            <button className="text-button" onClick={() => openRecord(selectedDay)}>
              补上一句话
              <Plus size={15} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
