import React, { useState } from 'react';
import { ChevronRight, Download, Leaf, Sparkles, Trash2, X } from 'lucide-react';
import { dateKey } from '../../domain/dates.js';
import { createDiaryExport, downloadDiary } from '../../services/export-diary.js';

export default function Settings({
  records,
  onClose,
  notify,
  onClearDemo,
  motionPreference,
  motionMode,
  onMotionChange,
}) {
  const [exporting, setExporting] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const clearDemo = () => {
    try {
      onClearDemo();
      setConfirmDemo(false);
    } catch {
      notify('示例没有清除成功，请检查浏览器存储后重试');
    }
  };
  const exportRecords = async () => {
    setExporting(true);
    try {
      const data = await createDiaryExport(records);
      downloadDiary(data, dateKey());
      notify('记录与录音已导出');
    } catch {
      notify('导出没有完成，请重试');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="settings-panel">
      <div className="modal-heading">
        <span className="eyebrow">YOUR LITTLE SPACE</span>
        <button className="icon-button" onClick={onClose} aria-label="关闭设置">
          <X size={20} />
        </button>
      </div>
      <h2>把日子，留给自己。</h2>
      <div className="settings-note">
        <Leaf size={21} />
        <div>
          <strong>记录保存在这台设备</strong>
          <p>文字和录音存于当前浏览器。更换设备或清理浏览器前，请先导出。</p>
        </div>
      </div>
      <label className="settings-motion">
        <span>
          抽牌动效<small>{motionMode === 'full' ? '完整翻牌' : '柔和过渡'}</small>
        </span>
        <select
          aria-label="抽牌动效"
          value={motionPreference}
          onChange={(event) => onMotionChange(event.target.value)}
        >
          <option value="system">跟随系统</option>
          <option value="full">完整</option>
          <option value="gentle">柔和</option>
        </select>
      </label>
      <button className="settings-row" onClick={exportRecords} disabled={exporting}>
        <Download size={19} />
        <span>
          {exporting ? '正在打包录音…' : '导出全部记录'}
          <small>含文字、牌面信息和原始录音</small>
        </span>
        <ChevronRight size={17} />
      </button>
      <button
        className="settings-row"
        onClick={() => setConfirmDemo(true)}
        disabled={!records.some((record) => record.demo)}
      >
        <Trash2 size={19} />
        <span>
          清除示例记录<small>保留你自己抽过的牌和写下的话</small>
        </span>
        <ChevronRight size={17} />
      </button>
      {confirmDemo && (
        <div className="delete-confirm">
          <p>清除带「示例」标记的记录？</p>
          <button className="text-button" onClick={() => setConfirmDemo(false)}>
            取消
          </button>
          <button className="danger-button" onClick={clearDemo}>
            清除示例
          </button>
        </div>
      )}
      <div className="settings-about">
        <Sparkles size={22} strokeWidth={1} />
        <strong>拾念</strong>
        <span>一天一张牌，一天一句话。</span>
        <small>比赛交互原型 · 2026</small>
      </div>
    </div>
  );
}
