'use client';

import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ReviewWidgetProps {
  appointmentId: string;
  existingRating?: number;
  existingComment?: string;
}

export default function ReviewWidget({
  appointmentId,
  existingRating,
  existingComment,
}: ReviewWidgetProps) {
  const [rating, setRating] = useState<number>(existingRating || 5);
  const [comment, setComment] = useState<string>(existingComment || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(Boolean(existingRating));

  const handleSaveReview = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        rating,
        reviewComment: comment.trim(),
        ratedAt: Date.now(),
      });
      setSaved(true);
    } catch {
      alert('שגיאה בשמירת הדירוג');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-400">הדירוג שלך נשמר תודה!</span>
          <span>{'⭐'.repeat(rating)}</span>
        </div>
        {comment && <p className="text-zinc-300 text-[11px]">&quot;{comment}&quot;</p>}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2">
      <div className="text-xs font-bold text-zinc-200">איך הייתה התספורת? דרג אותנו:</div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={`text-lg transition transform hover:scale-110 ${
              star <= rating ? 'opacity-100' : 'opacity-30'
            }`}
          >
            ⭐
          </button>
        ))}
      </div>
      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="הערה קצרה לספר (אופציונלי)..."
        className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
      />
      <button
        type="button"
        disabled={saving}
        onClick={handleSaveReview}
        className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-1.5 rounded-lg text-xs transition"
      >
        {saving ? 'שומר דירוג...' : 'שלח דירוג ⭐'}
      </button>
    </div>
  );
}