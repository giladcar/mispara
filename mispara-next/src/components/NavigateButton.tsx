'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function NavigateButton() {
  const [address, setAddress] = useState('');
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        setAddress((snap.data().shopAddress || '').trim());
      }
    });
    return () => unsub();
  }, []);

  if (!address) return null;

  const encoded = encodeURIComponent(address);
  const wazeUrl = `https://waze.com/ul?q=${encoded}&navigate=yes`;
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  return (
    <>
      <button
        onClick={() => setOpenMenu(true)}
        className="bg-zinc-800 hover:bg-zinc-700 text-sky-400 border border-sky-500/30 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl flex items-center gap-1 transition"
        title={`ניווט אל ${address}`}
      >
        <span>📍</span>
        <span className="hidden sm:inline">ניווט</span>
      </button>

      {openMenu && (
        <div
          dir="rtl"
          onClick={() => setOpenMenu(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-xs w-full p-5 text-center space-y-3 shadow-2xl"
          >
            <div className="text-2xl">📍</div>
            <h3 className="text-base font-black text-white">ניווט למספרה</h3>
            <p className="text-xs text-zinc-400">{address}</p>
            <div className="space-y-2 pt-2">
              <a
                href={wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-sky-500 hover:bg-sky-400 text-zinc-950 font-black py-2.5 rounded-xl text-sm transition"
              >
                פתח ב-Waze 🚗
              </a>
              <a
                href={gmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black py-2.5 rounded-xl text-sm transition"
              >
                פתח ב-Google Maps 🗺️
              </a>
            </div>
            <button
              onClick={() => setOpenMenu(false)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 rounded-xl text-xs"
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </>
  );
}