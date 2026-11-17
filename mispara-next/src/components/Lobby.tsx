'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AnnouncementBanner from './AnnouncementBanner';
import ImLateButton from './ImLateButton';
import OfflineBanner from './OfflineBanner';
import BanGuard from './BanGuard';
import InstallAppButton from './InstallAppButton';
import NavigateButton from './NavigateButton';
import GalleryModal from './GalleryModal';
import RescheduleModal from './RescheduleModal';
import ContactBarberBtn from './ContactBarberBtn';
import QuickRebook from './QuickRebook';
import ReviewWidget from './ReviewWidget';

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
  status?: string;
  rating?: number;
  reviewComment?: string;
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

  const [bookingStep, setBookingStep] = useState<'service' | 'date' | 'time'>('service');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [reschedulingApp, setReschedulingApp] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [adminCanceledApps, setAdminCanceledApps] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
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
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
      setAppointments(all.filter((a) => a.status !== 'canceled_by_admin'));
      setAdminCanceledApps(all.filter((a) => a.status === 'canceled_by_admin' && a.userEmail === userEmail));
    });

    return () => {
      unsubSettings();
      unsubApps();
    };
  }, [userEmail]);

  const enabledServices = (settings.services && settings.services.length > 0 ? settings.services : DEFAULT_SERVICES)
    .filter((s) => s.enabled !== false);

  const activeService = enabledServices.find((s) => s.id === selectedServiceId) || null;

  useEffect(() => {
    if (selectedServiceId && !activeService) {
      setSelectedServiceId('');
      setSelectedDateStr('');
      setReschedulingApp(null);
      setBookingStep('service');
    }
  }, [selectedServiceId, activeService]);

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

  const isSlotBlockedByAdmin = (dateStr: string, timeStr: string, serviceDuration: number) => {
    const d = new Date(dateStr + 'T00:00:00');
    const rule = getDayRule(d.getDay());
    const startMins = timeToMins(timeStr);
    const endMins = startMins + serviceDuration;
    const step = Number(rule.interval) || 30;

    const blockedForDate = (settings.blockedSlots || []).filter((s) => s.startsWith(dateStr + '_'));
    return blockedForDate.some((key) => {
      const bTime = key.split('_')[1];
      if (!bTime) return false;
      const bStart = timeToMins(bTime);
      const bEnd = bStart + step;
      return startMins < bEnd && endMins > bStart;
    });
  };

  const isSlotBookedByPerson = (dateStr: string, timeStr: string, serviceDuration: number) => {
    const d = new Date(dateStr + 'T00:00:00');
    const rule = getDayRule(d.getDay());
    const startMins = timeToMins(timeStr);
    const endMins = startMins + serviceDuration;

    return appointments.some((a) => {
      if (a.date !== dateStr) return false;
      const aStart = timeToMins(a.time);
      const aDur = Number(a.serviceDuration) || Number(rule.interval) || 30;
      const aEnd = aStart + aDur;
      return startMins < aEnd && endMins > aStart;
    });
  };

  const now = new Date();
  const todayStr = formatDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const getVisibleSlotsForDate = (dateStr: string, serviceDuration: number) => {
    if (!isServiceAllowedOnDate(dateStr, serviceDuration)) return [];
    const d = new Date(dateStr + 'T00:00:00');
    const rule = getDayRule(d.getDay());
    const closeMins = timeToMins(rule.endTime);

    const baseSlots = generateBaseSlotsForDate(dateStr);
    const visible: { time: string; status: 'free' | 'taken' }[] = [];

    for (const time of baseSlots) {
      const startMins = timeToMins(time);
      if (startMins + serviceDuration > closeMins) continue;

      const isPast = dateStr === todayStr && startMins <= currentMinutes;
      if (isPast) continue;

      if (isSlotBlockedByAdmin(dateStr, time, serviceDuration)) continue;

      if (isSlotBookedByPerson(dateStr, time, serviceDuration)) {
        visible.push({ time, status: 'taken' });
      } else {
        visible.push({ time, status: 'free' });
      }
    }

    return visible;
  };

  const countFreeSlotsForDate = (dateStr: string) => {
    if (!activeService) return 0;
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return 0;

    const rule = getDayRule(d.getDay());
    if (!rule.enabled) return 0;
    if (settings.blockedDates && settings.blockedDates.includes(dateStr)) return 0;
    if (!isServiceAllowedOnDate(dateStr, activeService.duration)) return 0;

    return getVisibleSlotsForDate(dateStr, activeService.duration).filter((s) => s.status === 'free').length;
  };

  const myAppointments = appointments
    .filter((a) => a.userEmail === userEmail)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const myActiveFutureAppointments = myAppointments.filter((a) => {
    if (a.date > todayStr) return true;
    if (a.date === todayStr && timeToMins(a.time) > currentMinutes) return true;
    return false;
  });

  const maxActiveLimit = Number(settings.maxActivePerUser) || 0;
  const reachedBookingQuota = !reschedulingApp && maxActiveLimit > 0 && myActiveFutureAppointments.length >= maxActiveLimit;

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

  const handleChooseService = (srvId: string) => {
    setReschedulingApp(null);
    setSelectedServiceId(srvId);
    setSelectedDateStr('');
    setPendingSlot(null);
    setBookingStep('date');
  };

  const handleStartReschedule = (app: Appointment) => {
    const matchedSrv =
      enabledServices.find((s) => s.id === app.serviceId) ||
      enabledServices.find((s) => s.name === app.serviceName) ||
      enabledServices[0];

    if (!matchedSrv) {
      showToast('סוג הטיפול של תור זה אינו פעיל כרגע');
      return;
    }

    setReschedulingApp(app);
    setSelectedServiceId(matchedSrv.id);
    setSelectedDateStr('');
    setPendingSlot(null);
    setBookingStep('date');
    setSidebarOpen(false);
    showToast('בחר יום ושעה חדשים להעברת התור 📅');
  };

  const handleChooseDate = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setPendingSlot(null);
    setBookingStep('time');
  };

  const handleSelectSlot = (time: string) => {
    if (!activeService || activeService.enabled === false) {
      showToast('נא לבחור קודם סוג שירות פעיל');
      return;
    }
    if (reachedBookingQuota) {
      showToast(`הגעת למקסימום של ${maxActiveLimit} תורים פעילים במקביל. בטל תור קיים כדי לקבוע חדש.`);
      setSidebarOpen(true);
      return;
    }
    setPendingSlot(time);
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingApp || !pendingSlot || !selectedDateStr || !activeService) return;

    const stillFree = getVisibleSlotsForDate(selectedDateStr, activeService.duration).some(
      (s) => s.time === pendingSlot && s.status === 'free'
    );
    if (!stillFree) {
      showToast('אופס! השעה הזו כבר נתפסה');
      setPendingSlot(null);
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'appointments'), {
        userEmail,
        date: selectedDateStr,
        time: pendingSlot,
        firstName: reschedulingApp.firstName,
        lastName: reschedulingApp.lastName,
        phone: reschedulingApp.phone,
        serviceId: activeService.id,
        serviceName: activeService.name,
        servicePrice: activeService.price,
        serviceDuration: activeService.duration,
        status: 'active',
        createdAt: Date.now(),
      });

      await deleteDoc(doc(db, 'appointments', reschedulingApp.id));

      const calUrl = buildGoogleCalendarUrl(
        selectedDateStr,
        pendingSlot,
        reschedulingApp.firstName,
        reschedulingApp.lastName,
        activeService.name,
        activeService.duration
      );

      setReschedulingApp(null);
      setPendingSlot(null);
      setLastBookedCalUrl(calUrl);
      showToast('התור הועבר למועד החדש בהצלחה! ✓');
    } catch {
      showToast('שגיאה בהעברת התור');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSlot || !selectedDateStr || !activeService || activeService.enabled === false) {
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

    const stillFree = getVisibleSlotsForDate(selectedDateStr, activeService.duration).some(
      (s) => s.time === pendingSlot && s.status === 'free'
    );
    if (!stillFree) {
      showToast('אופס! השעה הזו כבר נתפסה');
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
        status: 'active',
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

  const handleDismissCanceledAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', id));
    } catch {
      showToast('שגיאה בהסרת ההודעה');
    }
  };

  const handleConfirmLogout = () => {
    if (!confirm('האם אתה בטוח שברצונך להתנתק מהחשבון?')) return;
    onLogout();
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const selectedDateObj = selectedDateStr ? new Date(selectedDateStr + 'T00:00:00') : null;
  const visibleSlotsForSelectedDate =
    activeService && selectedDateStr ? getVisibleSlotsForDate(selectedDateStr, activeService.duration) : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col" dir="rtl">
      <OfflineBanner />
      <BanGuard userEmail={userEmail} onBannedLogout={onLogout} />
      <AnnouncementBanner />

     {/* Header */}
      <header className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Top Row: Brand + Mobile Primary Buttons */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-lg shrink-0">✂</div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black text-white leading-tight">המספרה</h1>
                <p className="text-[11px] text-zinc-400 truncate max-w-[140px] sm:max-w-[180px]" dir="ltr">
                  {firstName ? `${firstName} ${lastName}` : userEmail}
                </p>
              </div>
            </div>

            <div className="flex sm:hidden items-center gap-1.5 shrink-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="relative bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <span>התורים שלי</span>
                <span className="bg-zinc-950 text-amber-400 text-[11px] px-1.5 py-0.5 rounded-full">
                  {myActiveFutureAppointments.length}{maxActiveLimit > 0 ? `/${maxActiveLimit}` : ''}
                </span>
                {adminCanceledApps.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-zinc-950 animate-ping" />
                )}
              </button>
              <button
                onClick={handleConfirmLogout}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-2.5 py-2 rounded-xl"
              >
                יציאה
              </button>
            </div>
          </div>

          {/* Second Row on Mobile / Right Side on Desktop */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 sm:pb-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <ContactBarberBtn />
              <NavigateButton />
              <GalleryModal />
              <InstallAppButton />
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="relative bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <span>התורים שלי</span>
                <span className="bg-zinc-950 text-amber-400 text-xs px-1.5 py-0.5 rounded-full">
                  {myActiveFutureAppointments.length}{maxActiveLimit > 0 ? `/${maxActiveLimit}` : ''}
                </span>
                {adminCanceledApps.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-zinc-950 animate-ping" />
                )}
              </button>
              <button
                onClick={handleConfirmLogout}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-2.5 py-2 rounded-xl"
              >
                יציאה
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-5">
        
        {/* Reschedule Active Banner */}
        {reschedulingApp && (
          <div className="bg-sky-500/15 border border-sky-500/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-sky-300 font-bold">
              🔄 מצב העברת תור: בחר יום ושעה חדשים להחלפת התור מ-{reschedulingApp.date} בשעה {reschedulingApp.time}
            </span>
            <button
              onClick={() => {
                setReschedulingApp(null);
                setBookingStep('service');
                setSelectedDateStr('');
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-3 py-1.5 rounded-lg self-start sm:self-auto"
            >
              בטל העברה ✕
            </button>
          </div>
        )}

        {/* Alert Banner if Admin Canceled an Appointment */}
        {adminCanceledApps.length > 0 && (
          <div className="bg-rose-950/60 border border-rose-500/50 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-rose-200 font-bold">
              ⚠️ יש לך {adminCanceledApps.length === 1 ? 'תור שבוטל' : `${adminCanceledApps.length} תורים שבוטלו`} על ידי האדמין. פתח את &quot;התורים שלי&quot; לפרטים.
            </span>
            <button
              onClick={() => setSidebarOpen(true)}
              className="bg-rose-500 hover:bg-rose-400 text-white font-bold px-3 py-1.5 rounded-lg self-start sm:self-auto"
            >
              צפה בפרטים
            </button>
          </div>
        )}

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

        {/* Quick Rebook Banner on Step 1 */}
        {bookingStep === 'service' && (
          <QuickRebook
            myAppointments={myAppointments}
            enabledServices={enabledServices}
            onQuickSelectService={handleChooseService}
          />
        )}

        {/* STEP 1: SERVICE SELECTION ONLY */}
        {bookingStep === 'service' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="text-center space-y-1 pb-2">
              <span className="inline-block bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-full">
                שלב 1 מתוך 3
              </span>
              <h2 className="text-xl font-black text-white">איזה טיפול תרצה לקבוע?</h2>
              <p className="text-xs text-zinc-400">בחר את סוג הטיפול כדי לעבור לבחירת יום פנוי ביומן</p>
            </div>

            {enabledServices.length === 0 ? (
              <div className="text-center py-8 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl">
                אין כרגע שירותים זמינים להזמנה. נסה שוב מאוחר יותר.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {enabledServices.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => handleChooseService(srv.id)}
                    className="p-4 rounded-2xl border bg-zinc-950 border-zinc-800 hover:border-amber-500 hover:bg-amber-500/10 text-right transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-base font-bold text-white group-hover:text-amber-400 transition">{srv.name}</div>
                      <div className="text-xs text-zinc-400 mt-1">⏱ משך הטיפול: {srv.duration} דקות</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black px-3 py-1.5 rounded-xl bg-zinc-900 group-hover:bg-amber-500 text-amber-400 group-hover:text-zinc-950 transition">
                        ₪{srv.price}
                      </span>
                      <span className="text-zinc-500 group-hover:text-amber-400 text-lg">❮</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP 2 & 3: CALENDAR & TIME SLOTS */}
        {(bookingStep === 'date' || bookingStep === 'time') && activeService && (
          <div className="space-y-5">
            <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">✂</span>
                <div>
                  <div className="text-xs text-zinc-400">טיפול נבחר:</div>
                  <div className="text-sm font-bold text-white">
                    {activeService.name} <span className="text-amber-400">({activeService.duration} דק&apos; • ₪{activeService.price})</span>
                  </div>
                </div>
              </div>
              {!reschedulingApp && (
                <button
                  onClick={() => {
                    setBookingStep('service');
                    setSelectedDateStr('');
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2 rounded-xl transition"
                >
                  החלף טיפול ↻
                </button>
              )}
            </div>

            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[11px] text-amber-400 font-bold">שלב 2: בחר יום ביומן</span>
                  <h2 className="text-lg font-bold text-white">
                    {monthsHe[month]} {year}
                  </h2>
                </div>
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
                <div>א&apos;</div><div>ב&apos;</div><div>ג&apos;</div><div>ד&apos;</div><div>ה&apos;</div><div>ו&apos;</div><div className="text-rose-400">ש&apos;</div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const dateStr = formatDate(new Date(year, month, day));
                  const freeCount = countFreeSlotsForDate(dateStr);
                  const canPick = freeCount > 0;
                  const isSelected = dateStr === selectedDateStr && canPick;

                  return (
                    <button
                      key={dateStr}
                      disabled={!canPick}
                      onClick={() => handleChooseDate(dateStr)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center transition border ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                          : canPick
                          ? 'bg-zinc-950 border-zinc-800 hover:border-amber-500/60 text-white'
                          : 'bg-zinc-950/30 border-transparent text-zinc-600 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="text-sm">{day}</span>
                      {canPick && (
                        <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-zinc-900 font-bold' : 'text-emerald-400'}`}>
                          {freeCount} פנויים
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* STEP 3: Time Slots */}
            {bookingStep === 'time' && selectedDateStr && selectedDateObj && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl">
                <div className="mb-4 pb-3 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-amber-400 font-bold">שלב 3: בחר שעה</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      יום {daysHe[selectedDateObj.getDay()]}, {selectedDateObj.getDate()} ב{monthsHe[selectedDateObj.getMonth()]}
                    </h3>
                  </div>
                </div>

                {visibleSlotsForSelectedDate.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">אין שעות זמינות ביום זה</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {visibleSlotsForSelectedDate.map((slot) => {
                      if (slot.status === 'taken') {
                        return (
                          <div
                            key={slot.time}
                            className="py-2.5 px-2 rounded-xl bg-zinc-950/50 border border-zinc-800/60 text-zinc-500 text-center flex flex-col items-center justify-center select-none"
                          >
                            <span className="text-sm line-through">{slot.time}</span>
                            <span className="text-[10px] font-bold text-rose-400/80 mt-0.5">תפוס</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={slot.time}
                          onClick={() => handleSelectSlot(slot.time)}
                          className={`py-3 rounded-xl border font-bold text-sm transition ${
                            reachedBookingQuota
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-zinc-950 hover:bg-amber-500 hover:text-zinc-950 border-zinc-700 hover:border-amber-400 text-white'
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* Reschedule Confirmation Modal */}
      {pendingSlot && activeService && reschedulingApp && (
        <RescheduleModal
          oldDate={reschedulingApp.date}
          oldTime={reschedulingApp.time}
          newDate={selectedDateStr}
          newTime={pendingSlot}
          serviceName={activeService.name}
          submitting={submitting}
          onConfirm={handleConfirmReschedule}
          onCancel={() => setPendingSlot(null)}
        />
      )}

      {/* Regular New Booking Modal */}
      {pendingSlot && activeService && selectedDateObj && !reschedulingApp && (
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
                  {activeService.name} ({activeService.duration} דק&apos;) • ₪{activeService.price}
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
              {/* Canceled by Admin Notifications */}
              {adminCanceledApps.map((cApp) => {
                const cd = new Date(cApp.date + 'T00:00:00');
                const cSrv = cApp.serviceName || 'תספורת';
                return (
                  <div key={cApp.id} className="bg-rose-950/50 border border-rose-500/50 rounded-xl p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-rose-300 leading-relaxed">
                      ⚠️ התור שלך ({cSrv} — יום {daysHe[cd.getDay()]}, {cd.getDate()}/{cd.getMonth() + 1} בשעה {cApp.time}) בוטל על ידי האדמין - מחק ביומן אם הוספת
                    </div>
                    <button
                      onClick={() => handleDismissCanceledAlert(cApp.id)}
                      className="w-full bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white border border-rose-500/40 text-xs font-bold py-1.5 rounded-lg transition"
                    >
                      הבנתי, הסר הודעה ✓
                    </button>
                  </div>
                );
              })}

              {/* Active & Past Appointments */}
              {myAppointments.length === 0 && adminCanceledApps.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm py-8">אין לך תורים בחשבון זה</p>
              ) : (
                myAppointments.map((app) => {
                  const d = new Date(app.date + 'T00:00:00');
                  const srvName = app.serviceName || 'תספורת';
                  const srvDur = app.serviceDuration || 30;
                  const calUrl = buildGoogleCalendarUrl(app.date, app.time, app.firstName, app.lastName, srvName, srvDur);
                  const isFuture = app.date > todayStr || (app.date === todayStr && timeToMins(app.time) > currentMinutes);

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
                          {srvName} ({srvDur} דק&apos;) — {app.firstName} {app.lastName}
                        </p>
                        <p className="text-[11px] text-zinc-500" dir="ltr">{app.phone}</p>
                      </div>

                      {isFuture ? (
                        <>
                          <ImLateButton
                            date={app.date}
                            time={app.time}
                            firstName={app.firstName}
                          />

                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-900">
                            <button
                              onClick={() => handleStartReschedule(app)}
                              className="bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-zinc-950 border border-sky-500/30 text-xs font-bold px-2.5 py-2 rounded-lg transition"
                            >
                              הזז תור 🔄
                            </button>
                            <a
                              href={calUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-center bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 text-xs font-bold py-2 px-2 rounded-lg transition"
                            >
                              יומן 📅
                            </a>
                            <button
                              onClick={() => handleCancelAppointment(app)}
                              className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold px-2.5 py-2 rounded-lg transition"
                            >
                              ביטול
                            </button>
                          </div>
                        </>
                      ) : (
                        <ReviewWidget
                          appointmentId={app.id}
                          existingRating={app.rating}
                          existingComment={app.reviewComment}
                        />
                      )}
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