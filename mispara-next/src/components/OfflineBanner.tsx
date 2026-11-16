'use client';

import React, { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-24 h-24 rounded-3xl bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center text-5xl mb-5 animate-pulse shadow-2xl shadow-rose-500/20">
        📡✕
      </div>
      <h1 className="text-4xl sm:text-5xl font-black text-rose-500 tracking-tight mb-3">
        אין אינטרנט!!
      </h1>
      <p className="text-base sm:text-lg text-zinc-300 max-w-md font-medium">
        החיבור לרשת אבד. לא ניתן לקבוע או לבטל תורים ללא חיבור לאינטרנט.
      </p>
      <div className="mt-6 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
        המסך ייסגר אוטומטית ברגע שהחיבור יחזור...
      </div>
    </div>
  );
}