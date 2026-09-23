'use client';

import { CheckCircle2, X } from 'lucide-react';

interface Notification {
  message: string;
}

interface NotificationToastProps {
  notification: {
    message: string;
  } | null;
  onClose: () => void;
}

export function NotificationToast({ notification, onClose }: NotificationToastProps) {
  if (!notification) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-white dark:bg-[#111625] border border-emerald-500/30 p-4 rounded-2xl shadow-2xl flex items-start gap-3 max-w-sm z-50 animate-bounce">
      <div className="w-7 h-7 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-900 dark:text-white">{notification.message}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Actualizado vía Realtime</p>
      </div>
      <button 
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}