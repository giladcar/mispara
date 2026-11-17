'use client';

import React from 'react';

interface RescheduleModalProps {
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  serviceName: string;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RescheduleModal({
  oldDate,
  oldTime,
  newDate,
  newTime,
  serviceName,
  submitting,
  onConfirm,
  onCancel,
}: RescheduleModalProps) {
  const daysHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const formatNice = (dStr: string, tStr: string) => {
    const d = new Date(dStr + 'T00:00:00');
    return `יום ${daysHe[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1} בשעה ${tStr}`;
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white">אישור העברת תור</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-white text-xl">
            ✕
          </button>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-400">טיפול:</span>
            <span className="font-bold text-amber-400">{serviceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">מועד קודם (יימחק):</span>
            <span className="font-bold text-rose-400 line-through">{formatNice(oldDate, oldTime)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-zinc-800">
            <span className="text-zinc-300 font-bold">מועד חדש:</span>
            <span className="font-black text-emerald-400">{formatNice(newDate, newTime)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-black py-3 rounded-xl text-sm transition"
          >
            {submitting ? 'מעביר תור...' : 'העבר תור למועד זה ✓'}
          </button>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-4 py-3 rounded-xl text-xs"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}