'use client';

import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(iosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (isInstalled || (!deferredPrompt && !isIOS)) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-amber-400 border border-amber-500/40 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl flex items-center gap-1.5 transition"
        title="התקן אפליקציה למכשיר"
      >
        <span>📲</span>
        <span className="hidden sm:inline">התקן אפליקציה</span>
        <span className="sm:hidden">התקן</span>
      </button>

      {showIOSModal && (
        <div
          dir="rtl"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl mx-auto">
              📲
            </div>
            <h3 className="text-lg font-black text-white">התקנת האפליקציה באייפון</h3>
            <ol className="text-right text-xs text-zinc-300 space-y-2.5 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <li>1. לחץ על כפתור השיתוף <b>(ריבוע עם חץ למעלה ⬆️)</b> בתחתית Safari.</li>
              <li>2. גלול למטה ובחר ב-<b>&quot;הוסף למסך הבית&quot; (Add to Home Screen)</b>.</li>
              <li>3. לחץ על <b>&quot;הוסף&quot; (Add)</b> בפינה העליונה.</li>
            </ol>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 rounded-xl text-xs"
            >
              הבנתי, תודה!
            </button>
          </div>
        </div>
      )}
    </>
  );
}