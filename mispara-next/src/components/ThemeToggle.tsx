'use client';

import React, { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mispara_theme');
    if (saved === 'light') {
      setIsLight(true);
      document.documentElement.classList.add('mispara-light');
    }
  }, []);

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add('mispara-light');
      localStorage.setItem('mispara_theme', 'light');
    } else {
      document.documentElement.classList.remove('mispara-light');
      localStorage.setItem('mispara_theme', 'dark');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={toggleTheme}
        className="bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl flex items-center gap-1 transition"
        title={isLight ? 'עבור למצב כהה' : 'עבור למצב בהיר'}
      >
        <span>{isLight ? '🌙' : '☀️'}</span>
        <span className="hidden sm:inline">{isLight ? 'כהה' : 'בהיר'}</span>
      </button>

      <style jsx global>{`
        html.mispara-light body,
        html.mispara-light .bg-zinc-950 {
          background-color: #f4f4f5 !important;
          color: #18181b !important;
        }
        html.mispara-light .bg-zinc-950\/50,
        html.mispara-light .bg-zinc-950\/30 {
          background-color: #e4e4e7 !important;
        }
        html.mispara-light .bg-zinc-900,
        html.mispara-light .bg-zinc-900\/90 {
          background-color: #ffffff !important;
          color: #18181b !important;
        }
        html.mispara-light .bg-zinc-800 {
          background-color: #e4e4e7 !important;
          color: #18181b !important;
        }
        html.mispara-light .hover\:bg-zinc-700:hover,
        html.mispara-light .hover\:bg-zinc-800:hover {
          background-color: #d4d4d8 !important;
        }
        html.mispara-light .border-zinc-800,
        html.mispara-light .border-zinc-700,
        html.mispara-light .border-zinc-900 {
          border-color: #d4d4d8 !important;
        }
        html.mispara-light .text-white,
        html.mispara-light .text-zinc-100,
        html.mispara-light .text-zinc-200 {
          color: #18181b !important;
        }
        html.mispara-light .text-zinc-300,
        html.mispara-light .text-zinc-400 {
          color: #52525b !important;
        }
        html.mispara-light .text-zinc-500 {
          color: #71717a !important;
        }
        html.mispara-light .text-amber-400 {
          color: #b45309 !important;
        }
        html.mispara-light .bg-amber-500 .text-zinc-950,
        html.mispara-light button.bg-amber-500,
        html.mispara-light a.bg-amber-500 {
          color: #09090b !important;
        }
      `}</style>
    </>
  );
}