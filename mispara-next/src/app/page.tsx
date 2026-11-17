'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Lobby from '../components/Lobby';
import SplashScreen from '../components/SplashScreen';

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('barber_verified_email');
    if (saved) {
      setUserEmail(saved);
    }
    setCheckingSession(false);
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setErrorMsg('נא להזין כתובת אימייל תקינה');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'שגיאה בשליחת הקוד');
      } else {
        setStep('otp');
      }
    } catch {
      setErrorMsg('שגיאת תקשורת מול השרת');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanCode = otpInput.trim();

    if (cleanCode.length !== 6) {
      setErrorMsg('נא להזין קוד בן 6 ספרות');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const otpRef = doc(db, 'barber_otps', cleanEmail);
      const snap = await getDoc(otpRef);
      if (!snap.exists()) {
        setErrorMsg('לא נמצא קוד פעיל, שלח קוד חדש');
        setLoading(false);
        return;
      }

      const data = snap.data();
      if (Date.now() > data.otpExpiry) {
        setErrorMsg('תוקף הקוד פג, שלח קוד חדש');
        setLoading(false);
        return;
      }

      if (data.otpCode !== cleanCode) {
        setErrorMsg('קוד שגוי, נסה שוב');
        setLoading(false);
        return;
      }

      await deleteDoc(otpRef);
      localStorage.setItem('barber_verified_email', cleanEmail);
      setUserEmail(cleanEmail);
    } catch {
      setErrorMsg('שגיאה באימות הקוד');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('barber_verified_email');
    setUserEmail(null);
    setStep('email');
    setOtpInput('');
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  if (userEmail) {
    return <Lobby userEmail={userEmail} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4" dir="rtl">
	  <SplashScreen />

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-2xl mb-3 shadow-lg shadow-amber-500/20">
            ✂
          </div>
          <h1 className="text-2xl font-black text-white">המספרה</h1>
          <p className="text-xs text-zinc-400 mt-1">כניסה מהירה לקביעת תורים</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3 mb-4 text-center">
            {errorMsg}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">כתובת אימייל</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white outline-none text-left"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-amber-500/10"
            >
              {loading ? 'שולח קוד...' : 'שלח קוד אימות למייל'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center">
              <p className="text-xs text-zinc-400">שלחנו קוד בן 6 ספרות לכתובת:</p>
              <p className="text-xs font-bold text-amber-400 mt-0.5" dir="ltr">{emailInput}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">קוד אימות</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-4 py-3 text-center text-xl tracking-[0.4em] font-bold text-white outline-none"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-amber-500/10"
            >
              {loading ? 'מאמת...' : 'כניסה למערכת'}
            </button>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                לא רואה את המייל? כדאי לבדוק בתיקיית <b>דואר זבל (Spam)</b> או <b>קידומי מכירות</b>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setOtpInput('');
                setErrorMsg('');
              }}
              className="w-full text-xs text-zinc-400 hover:text-white py-1"
            >
              החלף כתובת אימייל
            </button>
          </form>
        )}
      </div>
    </div>
  );
}