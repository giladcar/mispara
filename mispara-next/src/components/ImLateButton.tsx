'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ImLateButtonProps {
  date: string;
  time: string;
  firstName: string;
}

export default function ImLateButton({ date, time, firstName }: ImLateButtonProps) {
  const [barberPhone, setBarberPhone] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        setBarberPhone((snap.data().barberPhone || '').trim());
      }
    });

    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  if (!barberPhone) return null;

  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const appTimestamp = new Date(y, m - 1, d, hh, mm, 0).getTime();

  const diffMinutes = (appTimestamp - nowMs) / 60000;

  // Active from 60 minutes before the appointment until 15 minutes after start time
  const isWindowActive = diffMinutes <= 60 && diffMinutes >= -15;
  if (!isWindowActive) return null;

  const cleanDigits = barberPhone.replace(/\D/g, '');
  const intlPhone = cleanDigits.startsWith('0') ? '972' + cleanDigits.slice(1) : cleanDigits;
  const text = `היי, אני ${firstName}, בדרך למספרה לתור של ${time} — אאחר ב-5–10 דקות 🙏`;
  const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full text-center bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-zinc-950 border border-amber-500/40 text-xs font-bold py-2 rounded-lg transition"
    >
      אני מאחר (עדכן בוואטסאפ) 🏃‍♂️💬
    </a>
  );
}