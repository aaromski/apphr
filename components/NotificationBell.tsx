'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from '@/lib/notify-sound';
import { Bell, BellRing, CheckCheck, Trash2, X, TriangleAlert, Info, CheckCircle2 } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  status: string;
}

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  timestamp: number;
}

interface ToastNotif {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
}

export default function NotificationBell() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState<ToastNotif | null>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último status conocido por habitación: permite detectar transiciones reales
  // (por ejemplo: Ocupada -> Sucia) sin depender de la tabla notificaciones.
  const roomStatusRef = useRef<Map<string, string>>(new Map());
  const loadedRef = useRef(false);

  const unreadCount = notificaciones.filter((n) => !n.leida).length;

  const emitToast = useCallback((n: Notificacion) => {
    setToast({ id: n.id, titulo: n.titulo, mensaje: n.mensaje, tipo: n.tipo });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Única puerta de entrada para notificaciones nuevas: dispara sonido + toast y
  // agrega al historial local del panel.
  const agregarNotificacion = useCallback(
    (n: Omit<Notificacion, 'id' | 'leida' | 'timestamp'>) => {
      const nueva: Notificacion = {
        ...n,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        leida: false,
        timestamp: Date.now(),
      };
      setNotificaciones((prev) => [nueva, ...prev].slice(0, 40));
      playNotificationSound();
      emitToast(nueva);
    },
    [emitToast]
  );

  // Carga el estado inicial de las habitaciones y escucha las transiciones en
  // tiempo real (igual que el panel de recepción: sin tabla de notificaciones).
  useEffect(() => {
    let active = true;

    const loadStatuses = async () => {
      const { data } = await supabase.from('rooms').select('id, room_number, status');
      if (!active || !data) return;
      data.forEach((r: Room) => roomStatusRef.current.set(r.id, r.status));
      loadedRef.current = true;
    };
    loadStatuses();

    const channel = supabase
      .channel('limpieza-bell-rooms')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        (payload) => {
          const actual = payload.new as Room;
          const anterior = roomStatusRef.current.get(actual.id);

          // Registrar el nuevo estado en todo caso para detectar la próxima transición.
          if (actual?.id && actual?.status) {
            roomStatusRef.current.set(actual.id, actual.status);
          }

          if (!active || !loadedRef.current) return;

          // Nueva habitación en Sucia (transición real: antes no estaba en Sucia).
          if (actual.status === 'Sucia' && anterior !== 'Sucia') {
            agregarNotificacion({
              titulo: `Habitación ${actual.room_number} sucia`,
              mensaje: `La habitación ${actual.room_number} necesita limpieza`,
              tipo: 'sucia',
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [agregarNotificacion]);

  // Cierra el menú cuando se hace clic fuera
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (bellMenuRef.current && !bellMenuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const markAllRead = () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  const dismissNotificacion = (id: string) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => setNotificaciones([]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getIcon = (tipo: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('sucia') || t.includes('sla') || t.includes('limite') || t.includes('límite') || t.includes('tarde')) {
      return <TriangleAlert className="w-4 h-4 text-rose-500" />;
    }
    if (t.includes('check') || t.includes('lista') || t.includes('complete') || t.includes('complet')) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
    return <Info className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <>
      <div className="relative" ref={bellMenuRef}>
        <button
          onClick={() => setShowMenu((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={showMenu}
          aria-label="Notificaciones"
          className={`p-2 rounded-lg transition-colors relative ${
            showMenu
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="w-2 h-2 bg-indigo-500 rounded-full absolute top-1.5 right-1.5 animate-pulse" />
          )}
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-[22rem] bg-white/95 dark:bg-[#0C101D]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 z-50 overflow-hidden">
            {/* Encabezado */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  title="Marcar todo como leído"
                  className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={clearAll}
                  disabled={notificaciones.length === 0}
                  title="Limpiar historial"
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="max-h-96 overflow-y-auto overscroll-contain">
              {notificaciones.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <BellRing className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-400 dark:text-slate-500">No hay notificaciones recientes</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {notificaciones.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 flex items-start gap-3 transition-colors ${
                        n.leida ? '' : 'bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]'
                      } hover:bg-slate-50 dark:hover:bg-slate-800/40`}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-slate-100 dark:bg-slate-800">
                        {getIcon(n.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-snug ${
                            n.leida
                              ? 'text-slate-600 dark:text-slate-300'
                              : 'font-semibold text-slate-900 dark:text-white'
                          }`}
                        >
                          {n.titulo}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                          {n.mensaje}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                          {formatTime(n.timestamp)}
                        </span>
                      </div>
                      {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />}
                      <button
                        onClick={() => dismissNotificacion(n.id)}
                        title="Descartar"
                        className="p-1 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TOAST FLOTANTE DE NUEVA NOTIFICACIÓN */}
      {toast && (
        <div className="fixed top-24 left-4 right-4 max-w-md mx-auto bg-white/95 dark:bg-[#0C101D]/95 backdrop-blur-xl border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/10">
            {getIcon(toast.tipo)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
              {toast.titulo}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
              {toast.mensaje}
            </p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}