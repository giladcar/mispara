'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AnnouncementBanner from './AnnouncementBanner';
import ImLateButton from './ImLateButton';
import OfflineBanner from './OfflineBanner';
import BanGuard from './BanGuard';

interface LobbyProps {
  userEmail: string;
  onLogout: () => void;
}

interface DayRule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  interval: number;
  bufferMinutes: number;
  maxAppointmentsPerDay: number;
}

interface BarberService {
  id: string;
  name: string;
  price: number;
  duration: number;
  enabled?: boolean;
}

interface Appointment {
  id: string;
  userEmail: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  phone: string;
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number;
  serviceDuration?: number;
}

const DEFAULT_SERVICES: BarberService[] = [
  { id: 'srv_1', name: 'תספורת גבר', price: 60, duration: 30, enabled: true },
  { id: 'srv_2', name: 'תספורת + זקן', price: 80, duration: 45, enabled: true },
  { id: 'srv_3', name: 'תספורת ילד', price: 50, duration: 30, enabled: true },
];

export default function Lobby({ userEmail, onLogout }: LobbyProps) {
  const [settings, setSettings] = useState({
    activeDays: [0, 1, 2, 3, 4, 5],
    startTime: '15:00',
    endTime: '20:00',
    interval: 30,
    bufferMinutes: 0,
    maxAppointmentsPerDay: 0,
    maxActivePerUser: 2,
    services: DEFAULT_SERVICES,
    weeklyRules: null as Record<number, DayRule> | null,
    blockedDates: [] as string[],
    blockedSlots: [] as string[],
  });

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [selectedDateStr, setSelectedDateStr] = useState(() => formatDate(new Date()));
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [lastBookedCalUrl, setLastBookedCalUrl] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');

  const monthsHe = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const daysHe = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3600);
  };

  useEffect(() => {
    const loadSavedProfile = async () => {
      const localProfile = localStorage.getItem(`barber_profile_${userEmail}`);
      if (localProfile) {
        try {
          const parsed = JSON.parse(localProfile);
          if (parsed.firstName) setFirstName(parsed.firstName);
          if (parsed.lastName) setLastName(parsed.lastName);
          if (parsed.phone) setPhone(parsed.phone);
        } catch {}
      }

      try {
        const profileSnap = await getDoc(doc(db, 'barber_users', userEmail));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          if (data.firstName) setFirstName(data.firstName);
          if (data.lastName) setLastName(data.lastName);
          if (data.phone) setPhone(data.phone);
          localStorage.setItem(
            `barber_profile_${userEmail}`,
            JSON.stringify({
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              phone: data.phone || '',
            })
          );
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
      }
    };

    loadSavedProfile();
  }, [userEmail]);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings((prev) => {
          const mergedServices = data.services && data.services.length > 0 ? data.services : DEFAULT_SERVICES;
          return { ...prev, ...data, services: mergedServices };
        });
      }
    });

    const unsubApps = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
      setAppointments(list);
    });

    return () => {
      unsubSettings();
      unsubApps();
    };
  }, []);

  const enabledServices = (settings.services && settings.services.length > 0 ? settings.services : DEFAULT_SERVICES)
    .filter((s) => s.enabled !== false);

  const activeService = enabledServices.find((s) => s.id === selectedServiceId) || null;

  const timeToMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minsToTime = (mins: number) => {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  const getDayRule = (dayIndex: number): DayRule => {
    if (settings.weeklyRules && settings.weeklyRules[dayIndex]) {
      return settings.weeklyRules[dayIndex];
    }
    return {
      enabled: settings.activeDays.includes(dayIndex),
      startTime: settings.startTime || '15:00',
      endTime: settings.endTime || '20:00',
      interval: Number(settings.interval) || 30,
      bufferMinutes: Number(settings.bufferMinutes) || 0,
      maxAppointmentsPerDay: Number(settings.maxAppointmentsPerDay) || 0,
    };
  };

  const isServiceAllowedOnDate = (dateStr: string, serviceDuration: number) => {
    const d = new Date(dateStr + 'T00:00:00');
    const rule = getDayRule(d.getDay());
    if (!rule.enabled) return false;
    return serviceDuration <= (Number(rule.interval) || 30);
  };

  const generateBaseSlotsForDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const rule = getDayRule(d.getDay());
    if (!rule.enabled) return [];

    let current = timeToMins(rule.startTime);
    const end = timeToMins(rule.endTime);
    const step = Number(rule.interval) || 30;
    const buffer = Number(rule.bufferMinutes) || 0;
    const maxPerDay = Number(rule.maxAppointmentsPerDay) || 0;

    const slots: string[] = [];
    while (current + step <= end) {
      if (maxPerDay > 0 && slots.length >= maxPerDay) break;
      slots.push(minsToTime(current));
      current += step + buffer;
    }
    return slots;
  };

  const isSlotAvailableForService = (dateStr: string, timeStr: string, serviceDuration: number) => {
    if (!isServiceAllowedOnDate(dateStr, serviceDuration)) return false;

    const d = new Date(dateStr + 'T00:00:00');
    const rule = getDayRule(d.getDay());
    const closeMins = timeToMins(rule.endTime);
    const startMins = timeToMins(timeStr);
    const endMins = startMins + serviceDuration;

    if (endMins > closeMins) return false;

    const hasAppOverlap = appointments.some((a) => {
      if (a.date !== dateStr) return false;
      const aStart = timeToMins(a.time);
      const aDur = Number(a.serviceDuration) || Number(rule.interval) || 30;
      const aEnd = aStart + aDur;
      return startMins < aEnd && endMins > aStart;
    });
    if (hasAppOverlap) return false;

    const step = Number(rule.interval) || 30;
    const blockedForDate = (settings.blockedSlots || []).filter((s) => s.startsWith(dateStr + '_'));
    const hasBlockedOverlap = blockedForDate.some((key) => {
      const bTime = key.split('_')[1];
      if (!bTime) return false;
      const bStart = timeToMins(bTime);
      const bEnd = bStart + step;
      return startMins < bEnd && endMins > bStart;
    });
    if (hasBlockedOverlap) return false;

    return true;
  };

  const isDayOpen = (dateStr: string) => {
    if (!activeService) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return false;
    const rule = getDayRule(d.getDay());
    if (!rule.enabled) return false;
    if (settings.blockedDates && settings.blockedDates.includes(dateStr)) return false;
    if (!isServiceAllowedOnDate(dateStr, activeService.duration)) return false;
    return true;
  };

  const now = new Date();
  const todayStr = formatDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const myAppointments = appointments
    .filter((a) => a.userEmail === userEmail)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const myActiveFutureAppointments = myAppointments.filter((a) => {
    if (a.date > todayStr) return true;
    if (a.date === todayStr && timeToMins(a.time) > currentMinutes) return true;
    return false;
  });

  const maxActiveLimit = Number(settings.maxActivePerUser) || 0;
  const reachedBookingQuota = maxActiveLimit > 0 && myActiveFutureAppointments.length >= maxActiveLimit;

  const buildGoogleCalendarUrl = (
    dateStr: string,
    timeStr: string,
    fName: string,
    lName: string,
    srvName: string,
    durationMins: number
  ) => {
    const startTotal = timeToMins(timeStr);
    const endTotal = startTotal + durationMins;

    const dateClean = dateStr.replace(/-/g, '');
    const startFmt = `${dateClean}T${String(Math.floor(startTotal / 60)).padStart(2, '0')}${String(startTotal % 60).padStart(2, '0')}00`;
    const endFmt = `${dateClean}T${String(Math.floor(endTotal / 60)).padStart(2, '0')}${String(endTotal % 60).padStart(2, '0')}00`;

    const title = encodeURIComponent(`${srvName} - ${fName} ${lName}`);
    const details = encodeURIComponent(`תור למספרה: ${srvName} (${durationMins} דק') עבור ${fName} ${lName}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startFmt}/${endFmt}&details=${details}`;
  };

  const handleSelectSlot = (time: string) => {
    if (!activeService || activeService.enabled === false) {
      showToast('נא לבחור קודם סוג שירות פעיל למעלה');
      return;
    }
    if (reachedBookingQuota) {
      showToast(`הגעת למקסימום של ${maxActiveLimit} תורים פעילים במקביל. בטל תור קיים כדי לקבוע חדש.`);
      setSidebarOpen(true);
      return;
    }
    setPendingSlot(time);
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSlot || !activeService || activeService.enabled === false) {
      showToast('לא נבחר סוג שירות פעיל');
      setPendingSlot(null);
      return;
    }

    if (reachedBookingQuota) {
      showToast(`ניתן להחזיק עד ${maxActiveLimit} תורים עתידיים במקביל`);
      setPendingSlot(null);
      return;
    }

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = phone.trim();

    if (!cleanFirst || !cleanLast || cleanPhone.replace(/\D/g, '').length < 9) {
      showToast('נא למלא שם פרטי, שם משפחה וטלפון תקין');
      return;
    }

    if (!isSlotAvailableForService(selectedDateStr, pendingSlot, activeService.duration)) {
      showToast('אופס! השעה הזו כבר לא פנויה או לא מתאימה למשך הטיפול ביום זה');
      setPendingSlot(null);
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'appointments'), {
        userEmail,
        date: selectedDateStr,
        time: pendingSlot,
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone,
        serviceId: activeService.id,
        serviceName: activeService.name,
        servicePrice: activeService.price,
        serviceDuration: activeService.duration,
        createdAt: Date.now(),
      });

      const profileData = {
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'barber_users', userEmail), profileData, { merge: true });
      localStorage.setItem(`barber_profile_${userEmail}`, JSON.stringify(profileData));

      const calUrl = buildGoogleCalendarUrl(
        selectedDateStr,
        pendingSlot,
        cleanFirst,
        cleanLast,
        activeService.name,
        activeService.duration
      );
      setPendingSlot(null);
      setLastBookedCalUrl(calUrl);
      showToast('התור נקבע בהצלחה! ✂');
    } catch {
      showToast('שגיאה בשמירת התור');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (app: Appointment) => {
    if (app.userEmail !== userEmail) return;
    if (!confirm('בטוח שברצונך לבטל את התור?')) return;
    try {
      await deleteDoc(doc(db, 'appointments', app.id));
      showToast('התור בוטל בהצלחה');
    } catch {
      showToast('שגיאה בביטול התור');
    }
  };

  const handleConfirmLogout = () => {
    if (!confirm('האם אתה בטוח שברצונך להתנתק מהחשבון?')) return;
    onLogout();
  };

  const handleGoToday = () => {
    const today = new Date();
    setSelectedDateStr(formatDate(today));
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const selectedDateObj = new Date(selectedDateStr + 'T00:00:00');
  const selectedDayRule = getDayRule(selectedDateObj.getDay());
  const selectedDaySlots = generateBaseSlotsForDate(selectedDateStr);

  const countAvailableForDate = (dateStr: string) => {
    if (!activeService) return 0;
    if (!isServiceAllowedOnDate(dateStr, activeService.duration)) return 0;
    const slots = generateBaseSlotsForDate(dateStr);
    return slots.filter((time) => {
      const isPast = dateStr === todayStr && timeToMins(time) <= currentMinutes;
      if (isPast) return false;
      return isSlotAvailableForService(dateStr, time, activeService.duration);
    }).length;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col" dir="rtl">
      <OfflineBanner />
	  <BanGuard userEmail={userEmail} onBannedLogout={onLogout} />
      <AnnouncementBanner />

      {/* Header */}
      <header className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-lg">✂</div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white leading-tight">המספרה</h1>
              <p className="text-[11px] text-zinc-400 truncate max-w-[160px] sm:max-w-xs" dir="ltr">
                {firstName ? `${firstName} ${lastName}` : userEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            >
              <span>התורים שלי</span>
              <span className="bg-zinc-950 text-amber-400 text-xs px-1.5 py-0.5 rounded-full">
                {myActiveFutureAppointments.length}{maxActiveLimit > 0 ? `/${maxActiveLimit}` : ''}
              </span>
            </button>
            <button
              onClick={handleConfirmLogout}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-3 py-2 rounded-xl"
            >
              יציאה
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        
        {/* Quota Warning Banner */}
        {reachedBookingQuota && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-amber-300 font-medium">
              הגעת למכסה של <b>{maxActiveLimit}</b> תורים פעילים במקביל. כדי לקבוע מועד אחר, בטל אחד מהתורים הקיימים שלך.
            </span>
            <button
              onClick={() => setSidebarOpen(true)}
              className="bg-amber-500 text-zinc-950 font-bold px-3 py-1.5 rounded-lg self-start sm:self-auto"
            >
              צפה בתורים שלי
            </button>
          </div>
        )}

        {/* Step 1: Service Selector */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-xs font-black flex items-center justify-center">1</span>
              בחר סוג שירות / טיפול (חובה)
            </h2>
            {!activeService && (
              <span className="text-[11px] text-amber-400 font-bold animate-pulse">👈 בחר טיפול כדי לפתוח את היומן</span>
            )}
          </div>

          {enabledServices.length === 0 ? (
            <div className="text-center py-6 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl">
              אין כרגע שירותים זמינים להזמנה. נסה שוב מאוחר יותר.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {enabledServices.map((srv) => {
                const isSelected = activeService?.id === srv.id;
                return (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`p-3.5 rounded-xl border text-right transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-zinc-950 border-zinc-800 hover:border-amber-500/50 text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-bold ${isSelected ? 'text-amber-400' : 'text-white'}`}>{srv.name}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">⏱ {srv.duration} דקות</div>
                    </div>
                    <div className={`text-sm font-black px-2.5 py-1 rounded-lg ${isSelected ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-amber-400'}`}>
                      ₪{srv.price}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2: Calendar & Time Slots */}
        <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 transition ${!activeService ? 'opacity-50 pointer-events-none select-none' : ''}`}>
          {/* Calendar */}
          <section className="md:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl h-fit">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-xs font-black flex items-center justify-center">2</span>
                {monthsHe[month]} {year}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleGoToday}
                  className="px-3 h-9 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold"
                >
                  היום
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                  className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
                >
                  ❯
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                  className="w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
                >
                  ❮
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400 mb-2">
              <div>א'</div><div>ב'</div><div>ג'</div><div>ד'</div><div>ה'</div><div>ו'</div><div className="text-rose-400">ש'</div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const dateStr = formatDate(new Date(year, month, day));
                const open = isDayOpen(dateStr);
                const isSelected = dateStr === selectedDateStr && open;
                const availableCount = open ? countAvailableForDate(dateStr) : 0;

                return (
                  <button
                    key={dateStr}
                    disabled={!open}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center transition border ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                        : open && availableCount > 0
                        ? 'bg-zinc-950 border-zinc-800 hover:border-amber-500/60 text-white'
                        : 'bg-zinc-950/30 border-transparent text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm">{day}</span>
                    {open && availableCount > 0 && (
                      <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-zinc-900 font-bold' : 'text-emerald-400'}`}>
                        {availableCount} פנויים
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Time Slots */}
          <section className="md:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col">
            <div className="mb-4 pb-3 border-b border-zinc-800">
              <span className="text-xs text-amber-500 font-semibold">
                {activeService ? `שעות פנויות עבור ${activeService.name} (${activeService.duration} דק')` : 'יש לבחור סוג שירות קודם'}
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                יום {daysHe[selectedDateObj.getDay()]}, {selectedDateObj.getDate()} ב{monthsHe[selectedDateObj.getMonth()]}
              </h3>
            </div>

            {!activeService ? (
              <div className="text-center py-10 text-zinc-500 text-sm">בחר סוג שירות למעלה כדי לראות שעות פנויות</div>
            ) : !isServiceAllowedOnDate(selectedDateStr, activeService.duration) ? (
              <div className="text-center py-10 text-amber-400/90 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3">
                השירות <b>{activeService.name}</b> ({activeService.duration} דק') נעול ביום {daysHe[selectedDateObj.getDay()]} (אורך התורים ביום זה הוא {selectedDayRule.interval} דק'). בחר יום אחר בלוח השנה.
              </div>
            ) : !isDayOpen(selectedDateStr) || selectedDaySlots.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">המספרה סגורה בתאריך זה</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {selectedDaySlots.map((time) => {
                  const isPast = selectedDateStr === todayStr && timeToMins(time) <= currentMinutes;
                  const available = !isPast && isSlotAvailableForService(selectedDateStr, time, activeService.duration);

                  if (!available) {
                    return (
                      <div
                        key={time}
                        className="py-3 rounded-xl bg-zinc-950/50 border border-zinc-800/60 text-zinc-600 text-center text-sm line-through"
                      >
                        {time}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={time}
                      onClick={() => handleSelectSlot(time)}
                      className={`py-3 rounded-xl border font-bold text-sm transition ${
                        reachedBookingQuota
                          ? 'bg-zinc-950 border-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-zinc-950 hover:bg-amber-500 hover:text-zinc-950 border-zinc-700 hover:border-amber-400 text-white'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Booking Modal */}
      {pendingSlot && activeService && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">קביעת תור</h3>
              <button onClick={() => setPendingSlot(null)} className="text-zinc-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 mb-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">שירות נבחר:</span>
                <span className="text-xs font-bold text-amber-400">
                  {activeService.name} ({activeService.duration} דק') • ₪{activeService.price}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">מועד:</span>
                <span className="text-xs font-bold text-white">
                  יום {daysHe[selectedDateObj.getDay()]}, {selectedDateObj.getDate()}/{selectedDateObj.getMonth() + 1} בשעה {pendingSlot}
                </span>
              </div>
            </div>
            <form onSubmit={handleBookSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">שם פרטי *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="לדוגמה: עומר"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">שם משפחה *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="לדוגמה: כהן"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">מספר טלפון *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-0000000"
                  className="w-full bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none text-left"
                  dir="ltr"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl text-sm transition"
              >
                {submitting ? 'שומר תור...' : 'אישור וקביעת תור'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Booking Success Modal */}
      {lastBookedCalUrl && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mx-auto">✓</div>
            <h3 className="text-xl font-black text-white">התור נקבע בהצלחה!</h3>
            <p className="text-xs text-zinc-400">רוצה לקבל תזכורת אוטומטית לטלפון? הוסף את התור ליומן Google שלך:</p>
            <a
              href={lastBookedCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setLastBookedCalUrl(null)}
              className="block w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl text-sm transition"
            >
              הוסף ליומן Google 📅
            </a>
            <button
              onClick={() => setLastBookedCalUrl(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 rounded-xl text-xs"
            >
              סגור
            </button>
          </div>
        </div>
      )}

      {/* Sidebar My Appointments */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/70 z-40" />
          <aside className="fixed top-0 left-0 h-full w-full max-w-sm bg-zinc-900 border-r border-zinc-800 z-50 flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">התורים שלי</h3>
                <p className="text-[11px] text-zinc-400" dir="ltr">{userEmail}</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {myAppointments.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm py-8">אין לך תורים פעילים בחשבון זה</p>
              ) : (
                myAppointments.map((app) => {
                  const d = new Date(app.date + 'T00:00:00');
                  const srvName = app.serviceName || 'תספורת';
                  const srvDur = app.serviceDuration || 30;
                  const calUrl = buildGoogleCalendarUrl(app.date, app.time, app.firstName, app.lastName, srvName, srvDur);
                  return (
                    <div key={app.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-amber-400">
                            יום {daysHe[d.getDay()]}, {d.getDate()}/{d.getMonth() + 1} | {app.time}
                          </p>
                          {app.servicePrice && (
                            <span className="text-xs font-bold text-emerald-400">₪{app.servicePrice}</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-zinc-200 mt-1">
                          {srvName} ({srvDur} דק') — {app.firstName} {app.lastName}
                        </p>
                        <p className="text-[11px] text-zinc-500" dir="ltr">{app.phone}</p>
                      </div>

                      <ImLateButton
                        date={app.date}
                        time={app.time}
                        firstName={app.firstName}
                      />

                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-900">
                        <a
                          href={calUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 text-xs font-bold py-2 rounded-lg transition"
                        >
                          הוסף ליומן 📅
                        </a>
                        <button
                          onClick={() => handleCancelAppointment(app)}
                          className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold px-3 py-2 rounded-lg transition"
                        >
                          ביטול תור
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-80 bg-zinc-800 border border-amber-500/40 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-medium z-50 text-center">
          {toast}
        </div>
      )}
    </div>
  );
}