'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const FALLBACK_BARBER_PHONE = '0500000000'; // החלף למספר הטלפון שלך

export default function ContactBarberBtn() {
  const [phone, setPhone] = useState(FALLBACK_BARBER_PHONE);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists() && snap.data().barberPhone) {
        setPhone(String(snap.data().barberPhone).trim());
      }
    });
    return () => unsub();
  }, []);

  const cleanDigits = phone.replace(/\D/g, '');
  if (!cleanDigits || cleanDigits === '0500000000') return null;

  const intlPhone = cleanDigits.startsWith('0') ? '972' + cleanDigits.slice(1) : cleanDigits;
  const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent('היי, יש לי שאלה לגבי תור במספרה ✂')}`;
  const telUrl = `tel:${cleanDigits}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl flex items-center gap-1 transition"
        title="יצירת קשר עם הספר"
      >
        <span>💬</span>
        <span className="hidden sm:inline">צור קשר</span>
      </button>

      {open && mounted && createPortal(
        <div
          dir="rtl"
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-xs w-full p-5 text-center space-y-3 shadow-2xl"
          >
            <div className="text-3xl">✂</div>
            <h3 className="text-lg font-black text-white">יצירת קשר עם המספרה</h3>
            <p className="text-xs text-zinc-400" dir="ltr">{phone}</p>
            <div className="space-y-2 pt-1">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black py-3 rounded-xl text-sm transition"
              >
                שלח הודעת WhatsApp 💬
              </a>
              <a
                href={telUrl}
                className="block w-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-bold py-3 rounded-xl text-sm transition"
              >
                חיוג טלפוני 📞
              </a>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-full text-zinc-400 hover:text-white font-bold py-1.5 text-xs"
            >
              סגור
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}