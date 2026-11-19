'use client';

import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ImLateButtonProps {
  date: string;
  time: string;
  firstName: string;
}

export default function ImLateButton({ date, time, firstName }: ImLateButtonProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMins, setSentMins] = useState<number | null>(null);

  const handleSendLate = async (mins: number) => {
    setSending(true);
    try {
      await addDoc(collection(db, 'late_alerts'), {
        date,
        time,
        firstName,
        delayMinutes: mins,
        createdAt: Date.now(),
      });
      setSentMins(mins);
      setOpen(false);
    } catch {
      alert('שגיאה בשליחת הודעת איחור');
    } finally {
      setSending(false);
    }
  };

  if (sentMins) {
    return (
      <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl text-center">
        ⏰ נשלחה הודעה לספר על איחור של כ-{sentMins} דקות
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
        >
          <span>⏰</span>
          <span>אני מאחר לתור — עדכן את הספר</span>
        </button>
      ) : (
        <div className="bg-zinc-900 border border-amber-500/40 rounded-xl p-2.5 space-y-2">
          <div className="text-[11px] font-bold text-zinc-300 text-center">בכמה דקות תאחר?</div>
          <div className="grid grid-cols-3 gap-1.5">
            {[5, 10, 15].map((m) => (
              <button
                key={m}
                type="button"
                disabled={sending}
                onClick={() => handleSendLate(m)}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs py-1.5 rounded-lg transition"
              >
                {m} דק&apos;
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-[11px] text-zinc-400 hover:text-white pt-0.5"
          >
            ביטול
          </button>
        </div>
      )}
    </div>
  );
}