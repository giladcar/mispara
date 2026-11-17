'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface GalleryItem {
  id: string;
  title: string;
  url: string;
}

export default function GalleryModal() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().gallery)) {
        setItems(snap.data().gallery);
      } else {
        setItems([]);
      }
    });
    return () => unsub();
  }, []);

  // Hide completely when there are no images (just like AnnouncementBanner)
  if (items.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl flex items-center gap-1 transition"
      >
        <span>🖼️</span>
        <span className="hidden sm:inline">קטלוג</span>
      </button>

      {isOpen && (
        <div
          dir="rtl"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white">קטלוג תספורות והשראה ✂</h3>
                <p className="text-xs text-zinc-400">בחר סגנון והראה לספר כשתתיישב בכיסא</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
                >
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-56 object-cover"
                  />
                  <div className="p-3 text-center font-bold text-sm text-amber-400">
                    {item.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}