'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function AnnouncementBanner() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        setMessage((snap.data().announcementBanner || '').trim());
      }
    });
    return () => unsub();
  }, []);

  if (!message) return null;

  return (
    <div className="bg-amber-500 text-zinc-950 px-4 py-2.5 text-center text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-2">
      <span>📢</span>
      <span>{message}</span>
    </div>
  );
}