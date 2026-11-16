'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BanGuardProps {
  userEmail: string;
  onBannedLogout: () => void;
}

export default function BanGuard({ userEmail, onBannedLogout }: BanGuardProps) {
  const [banReason, setBanReason] = useState<string | null>(null);

  useEffect(() => {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (!cleanEmail) return;

    const q = query(collection(db, 'blocked_users'), where('email', '==', cleanEmail));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const reason = snap.docs[0].data().reason || 'הפרת נהלי המספרה';
        setBanReason(reason);
        localStorage.removeItem('barber_user_email');
      } else {
        setBanReason(null);
      }
    });

    return () => unsub();
  }, [userEmail]);

  if (!banReason) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-24 h-24 rounded-3xl bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center text-5xl mb-5 animate-pulse shadow-2xl shadow-rose-500/20">
        🚫
      </div>
      <h1 className="text-3xl sm:text-4xl font-black text-rose-500 tracking-tight mb-3">
        אתה נחסמת!!
      </h1>
      <p className="text-base sm:text-lg text-zinc-200 max-w-md font-bold bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
        סיבה: {banReason}
      </p>
      <button
        onClick={onBannedLogout}
        className="mt-6 bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-6 py-3 rounded-xl text-sm"
      >
        חזרה למסך הכניסה
      </button>
    </div>
  );
}