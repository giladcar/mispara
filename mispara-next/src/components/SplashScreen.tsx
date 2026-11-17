'use client';

import React, { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 2600);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 bg-zinc-950 z-[99999] flex flex-col items-center justify-between p-8 transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5">
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
          <div className="absolute w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-3xl shadow-lg shadow-amber-500/30">
            ✂
          </div>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-black text-white tracking-wide">המספרה</h1>
          <p className="text-xs text-zinc-400 animate-pulse">טוען את האתר...</p>
        </div>
      </div>

      <div className="pb-4 text-center">
        <span
          className="inline-block bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs sm:text-sm font-black tracking-widest px-4 py-2 rounded-full shadow-lg"
          dir="ltr"
        >
          MADE BY <span className="text-amber-400">gilad_c</span>
        </span>
      </div>
    </div>
  );
}