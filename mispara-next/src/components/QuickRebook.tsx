'use client';

import React from 'react';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration: number;
  enabled?: boolean;
}

interface PastAppointment {
  serviceId?: string;
  serviceName?: string;
  date: string;
  time: string;
}

interface QuickRebookProps {
  myAppointments: PastAppointment[];
  enabledServices: ServiceItem[];
  onQuickSelectService: (serviceId: string) => void;
}

export default function QuickRebook({
  myAppointments,
  enabledServices,
  onQuickSelectService,
}: QuickRebookProps) {
  if (!myAppointments || myAppointments.length === 0 || enabledServices.length === 0) {
    return null;
  }

  // Find the most recent appointment of this customer
  const sorted = [...myAppointments].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const lastApp = sorted[0];

  const matchedService =
    enabledServices.find((s) => s.id === lastApp.serviceId) ||
    enabledServices.find((s) => s.name === lastApp.serviceName);

  if (!matchedService) return null;

  return (
    <div className="bg-gradient-to-l from-amber-500/15 to-zinc-900 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
      <div>
        <span className="text-[11px] font-bold text-amber-400">⚡ הזמנה מהירה ללקוח חוזר</span>
        <div className="text-sm font-black text-white mt-0.5">
          הזמן שוב: {matchedService.name}{' '}
          <span className="text-xs font-normal text-zinc-300">
            ({matchedService.duration} דק&apos; • ₪{matchedService.price})
          </span>
        </div>
      </div>
      <button
        onClick={() => onQuickSelectService(matchedService.id)}
        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs px-4 py-2.5 rounded-xl transition whitespace-nowrap self-start sm:self-auto shadow-md shadow-amber-500/20"
      >
        בחר תאריך מיד ❮
      </button>
    </div>
  );
}