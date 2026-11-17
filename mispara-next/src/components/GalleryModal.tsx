'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().gallery)) {
        setItems(snap.data().gallery);
      } else {
        setItems([]);
      }
    });
    return () => unsub();
  }, []);

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

      {isOpen && mounted && createPortal(
        <div
          dir="rtl"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full max-h-[88dvh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Fixed Top Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">קטלוג תספורות והשראה ✂ ({items.length})</h3>
                <p className="text-[11px] text-zinc-400">גלול למטה ובחר סגנון להראות לספר</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center justify-center shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Images Area */}
            <div className="p-4 overflow-y-auto overscroll-contain flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col shrink-0"
                >
                  <div className="w-full bg-black flex items-center justify-center">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full max-h-80 object-contain"
                    />
                  </div>
                  <div className="p-3 text-center font-bold text-sm text-amber-400 border-t border-zinc-900">
                    {item.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}