'use client';

import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AuthProps {
  onLoginSuccess: (email: string) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('נא להזין כתובת אימייל תקינה');
      return;
    }

    setLoading(true);
    try {
      // 1. Check if user is blocked BEFORE sending any email
      const q = query(collection(db, 'blocked_users'), where('email', '==', cleanEmail));
      const blockedSnap = await getDocs(q);
      if (!blockedSnap.empty) {
        const reason = blockedSnap.docs[0].data().reason || 'הפרת נהלי המספרה';
        setError(`אתה נחסמת (${reason})`);
        setLoading(false);
        return;
      }

      // 2. Not blocked -> ask server to generate and send OTP email
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'שגיאה בשליחת המייל.');
        setLoading(false);
        return;
      }

      setStep('otp');
    } catch {
      setError('שגיאת תקשורת מול השרת');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = inputCode.trim();

    if (!cleanCode) {
      setError('נא להזין את קוד האימות');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'קוד אימות שגוי או פג תוקף');
        setLoading(false);
        return;
      }

      localStorage.setItem('barber_user_email', cleanEmail);
      onLoginSuccess(cleanEmail);
    } catch {
      setError('שגיאת תקשורת בעת אימות הקוד');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl mx-auto mb-3">
            ✂
          </div>
          <h1 className="text-2xl font-black text-white">מערכת תורים למספרה</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {step === 'email' ? 'הזן אימייל לקבלת קוד כניסה חד-פעמי' : `הזן את הקוד שנשלח אל ${email}`}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm font-bold text-center">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">כתובת אימייל</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white outline-none text-left"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl text-sm transition"
            >
              {loading ? 'בודק ושולח קוד...' : 'שלח קוד אימות למייל'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">קוד אימות (6 ספרות)</label>
              <input
                type="text"
                required
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-3 text-center text-lg tracking-widest font-bold text-white outline-none"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl text-sm transition"
            >
              {loading ? 'מאמת קוד...' : 'אמת והיכנס למערכת'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); }}
              className="w-full text-xs text-zinc-400 hover:text-white py-1"
            >
              שינוי כתובת אימייל
            </button>
          </form>
        )}
      </div>
    </div>
  );
}