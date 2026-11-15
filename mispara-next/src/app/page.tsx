'use client';

import React, { useState, useEffect } from 'react';
import Auth from '../components/Auth';
import Lobby from '../components/Lobby';

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('barber_verified_email');
    if (saved) setUserEmail(saved);
    setChecking(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('barber_verified_email');
    setUserEmail(null);
  };

  if (checking) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  if (!userEmail) {
    return <Auth onLoginSuccess={(email) => setUserEmail(email)} />;
  }

  return <Lobby userEmail={userEmail} onLogout={handleLogout} />;
}