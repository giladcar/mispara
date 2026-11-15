'use client';

import React, { useState } from 'react';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AuthProps {
  onLoginSuccess: (email: string) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('נא להזין כתובת אימייל תקינה');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'שגיאה בשליחת קוד האימות');
      }

      setStep('code');
    } catch (err: any) {
      setError(err.message || 'תקלה בתקשורת מול השרת');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (cleanCode.length !== 6) {
      setError('נא להזין קוד בן 6 ספרות');
      return;
    }

    setLoading(true);
    try {
      const otpRef = doc(db, 'barber_otps', cleanEmail);
      const otpSnap = await getDoc(otpRef);

      if (!otpSnap.exists()) {
        throw new Error('לא נמצא קוד פעיל עבור אימייל זה, נסה לשלוח שוב');
      }

      const data = otpSnap.data();
      if (Date.now() > data.otpExpiry) {
        throw new Error('פג תוקף הקוד (עברו 10 דקות), שלח קוד חדש');
      }

      if (data.otpCode !== cleanCode) {
        throw new Error('קוד שגוי! בדוק שוב במייל ונסה שנית');
      }

      // מחיקת הקוד החד-פעמי לאחר שימוש מוצלח
      await deleteDoc(otpRef);
      localStorage.setItem('barber_verified_email', cleanEmail);
      onLoginSuccess(cleanEmail);
    } catch (err: any) {
      setError(err.message || 'שגיאה באימות הקוד');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-zinc-950 flex items-center justify-center text-3xl font-black mx-auto mb-3 shadow-lg shadow-amber-500/20">
            ✂
          </div>
          <h1 className="text-2xl font-black text-white">המספרה</h1>
          <p className="text-xs text-zinc-400 mt-1">
            {step === 'email'
              ? 'הזן כתובת אימייל לקבלת קוד כניסה חד-פעמי'
              : `שלחנו קוד בן 6 ספרות לכתובת ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">כתובת אימייל *</label>
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

            {error && <p className="text-xs text-rose-400 text-center font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-amber-500/10"
            >
              {loading ? 'שולח קוד למייל...' : 'שלח קוד אימות ✉'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 text-center">הזן את הקוד בן 6 הספרות שקיבלת במייל</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-3.5 text-center text-2xl font-black tracking-[0.5em] text-amber-400 outline-none"
                dir="ltr"
              />
            </div>

            {error && <p className="text-xs text-rose-400 text-center font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl text-sm transition"
            >
              {loading ? 'מאמת קוד...' : 'אמת קוד והיכנס ליומן ✓'}
            </button>

            <div className="flex justify-between items-center pt-2 text-xs">
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="text-zinc-400 hover:text-white underline"
              >
                החלף כתובת אימייל
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSendCode}
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                שלח קוד שוב
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}