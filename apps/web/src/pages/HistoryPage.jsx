import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Leaf, Plus, Search, X } from 'lucide-react';
import { dateKey, parseDate, shortDate } from '../domain/dates.js';
import { getCard } from '../domain/cards.js';
import { hasReflection } from '../domain/diary.js';

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
  const [query, setQuery] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const monthKey = dateKey(month).slice(0, 7);
  const dateRecords = records.filter((record) =>
    selectedDay ? record.date === selectedDay : record.date.startsWith(monthKey),
  );
  const filteredRecords = dateRecords
    .filter((record) => {
      if (resultFilter === 'noted' && !hasReflection(record)) return false;
      if (resultFilter === 'pending' && hasReflection(record)) return false;
      const name = record.cardId ? getCard(record.cardId).name : '';
      return `${record.text} ${name}`.toLowerCase().includes(query.trim().toLowerCase());
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">THE DAYS YOU LIVED</p>
        <h1>日子，慢慢有了回声。</h1>
        <p className="heading-sub">{completed.length} 个留下来的片刻</p>
      </div>
      <div className="history-layout">
        <section className="calendar-section" aria-label="记录日历">
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
                const done =
                  record && (record.status !== 'pending' || record.text || record.audioId);
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
            <h2>{selectedDay ? `${shortDate(selectedDay)}的片刻` : '本月的片刻'}</h2>
            <div className="history-section-actions">
              {selectedDay && (
                <button className="text-button" onClick={() => setSelectedDay(null)}>
                  查看全部
                  <X size={13} />
                </button>
              )}
              <button
                className={`icon-button filter-toggle ${query || resultFilter !== 'all' ? 'is-filtered' : ''}`}
                aria-label="展开记录筛选"
                title="搜索与筛选"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                <Search size={18} />
              </button>
            </div>
          </div>
          <div className={`history-filters ${filtersOpen ? 'is-open' : ''}`}>
            <label className="search-field">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                aria-label="搜索记录"
                placeholder="找一句话、一张牌"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="status-filter">
              <span className="sr-only">记录状态</span>
              <select
                aria-label="记录状态"
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value)}
              >
                <option value="all">全部记录</option>
                <option value="noted">已记录</option>
                <option value="pending">待回看</option>
              </select>
            </label>
          </div>
          <p className="result-count" aria-live="polite">
            {filteredRecords.length} 条记录{selectedDay ? '' : ` · ${month.getMonth() + 1} 月`}
          </p>
          {filteredRecords.map((record) => renderEntry(record))}
          {selectedDay && dateRecords.length === 0 && !query && resultFilter === 'all' ? (
            <div className="empty-day">
              <Leaf size={26} strokeWidth={1} />
              <p>这一天，安静地经过了。</p>
              <button className="text-button" onClick={() => openRecord(selectedDay)}>
                补上一句话
                <Plus size={15} />
              </button>
            </div>
          ) : (
            filteredRecords.length === 0 && (
              <div className="empty-day">
                <Search size={25} strokeWidth={1.4} />
                <p>
                  {query || resultFilter !== 'all'
                    ? '没有找到对应的片刻。'
                    : '这个月，还没有留下记录。'}
                </p>
                {query || resultFilter !== 'all' ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      setQuery('');
                      setResultFilter('all');
                    }}
                  >
                    清除筛选
                    <X size={14} />
                  </button>
                ) : (
                  <button className="text-button" onClick={() => openRecord()}>
                    留下一句话
                    <Plus size={15} />
                  </button>
                )}
              </div>
            )
          )}
        </section>
      </div>
    </>
  );
}
