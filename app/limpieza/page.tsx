'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BellRing, CheckCircle2, Clock, Timer, TriangleAlert, Star, X } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  room_type?: string;
  zone?: string;
  status: string;
  hotel_id: string;
  cleaning_timer?: string;
  cleaning_started_at?: string | null;
  is_priority?: boolean;
}

interface UserProfile {
  nombre: string;
  role: string;
  hotel_id?: string;
}

interface TypeConfig {
  room_type: string;
  tiempo_estandar_min: number;
  sla_min: number;
}

interface Notificacion {
  id: string;
  hotel_id: string;
  habitacion_id?: string | null;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  created_at: string;
}

export default function LimpiezaMobilePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [typeConfigs, setTypeConfigs] = useState<Record<string, TypeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [zonas, setZonas] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [prioritariasOnly, setPrioritariasOnly] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  // Evita disparar el webhook de tiempo límite en cada tick para la misma habitación
  const slaNotifiedRef = useRef<Set<string>>(new Set());

  // Reloj base para todos los cronómetros (tick cada segundo)
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // 1. Cargar usuario activo y su perfil
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombre, role, hotel_id')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserProfile({
            nombre: profile.nombre || 'Usuario',
            role: profile.role || 'Limpieza',
            hotel_id: profile.hotel_id,
          });
        }
      }
    };

    fetchUserData();
  }, []);

  // 1.1 Cargar la configuración de tiempos estándar / tiempo límite y los pisos del hotel
  useEffect(() => {
    if (!userProfile?.hotel_id) return;

    const loadHotelConfig = async () => {
      const { data: cfg } = await supabase
        .from('room_type_config')
        .select('room_type, tiempo_estandar_min, sla_min')
        .eq('hotel_id', userProfile.hotel_id);

      if (cfg) {
        setTypeConfigs(
          Object.fromEntries(
            cfg.map((c) => [c.room_type, c]) as [string, TypeConfig][]
          )
        );
      }

      const { data: zonasData } = await supabase
        .from('zonas')
        .select('nombre')
        .eq('hotel_id', userProfile.hotel_id)
        .order('nombre', { ascending: true });

      if (zonasData) {
        setZonas(zonasData.map((z) => z.nombre).filter((n): n is string => Boolean(n)));
      }
    };

    loadHotelConfig();
  }, [userProfile?.hotel_id]);

  // 2. Carga inicial de habitaciones
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true });

      if (data) setRooms(data);
      setLoading(false);
    };

    fetchRooms();
  }, []);

  // 3. Suscripción en tiempo real (habitaciones y notificaciones n8n)
  useEffect(() => {
    const channel = supabase
      .channel('limpieza-rooms-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Room;
            setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          } else if (payload.eventType === 'INSERT') {
            setRooms((prev) => [...prev, payload.new as Room]);
          } else if (payload.eventType === 'DELETE') {
            setRooms((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const notifChannel = supabase
      .channel('limpieza-notificaciones-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        (payload) => {
          const nueva = payload.new as Notificacion;
          if (nueva?.id) {
            setNotificaciones((prev) => [nueva, ...prev].slice(0, 50));
          }
        }
      )
      .subscribe();

    const fetchNotificaciones = async () => {
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNotificaciones(data.filter((n) => !n.leida));
    };
    fetchNotificaciones();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(notifChannel);
    };
  }, []);

  // ---- Helpers de tiempo ----
  const getElapsed = (startedAt?: string | null): number =>
    startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : 0;

  const formatDuration = (ms: number): string => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ---- Iniciar limpieza ----
  const handleStartCleaning = async (room: Room) => {
    const startedAt = new Date().toISOString();

    // Actualización optimista
    setRooms((prev) =>
      prev.map((r) =>
        r.id === room.id ? { ...r, status: 'En Limpieza', cleaning_started_at: startedAt } : r
      )
    );

    const { error } = await supabase
      .from('rooms')
      .update({ status: 'En Limpieza', cleaning_started_at: startedAt })
      .eq('id', room.id);

    if (error) {
      console.error('Error al iniciar limpieza:', error.message);
      setRooms((prev) =>
        prev.map((r) =>
          r.id === room.id
            ? { ...r, status: room.status, cleaning_started_at: room.cleaning_started_at }
            : r
        )
      );
      alert(`No se pudo iniciar la limpieza: ${error.message}`);
    }
  };

  // ---- Completar limpieza: registra duración real y cumplimiento de tiempo límite ----
  const handleFinishCleaning = async (room: Room) => {
    const durationMs = getElapsed(room.cleaning_started_at);
    const durationMin = Math.round(durationMs / 60000);

    const cfg = typeConfigs[room.room_type || ''];
    const slaMin = cfg?.sla_min ?? 45;
    const cumplioSla = durationMin <= slaMin;

    // Actualización optimista
    setRooms((prev) =>
      prev.map((r) =>
        r.id === room.id ? { ...r, status: 'Limpia/Lista', cleaning_started_at: null } : r
      )
    );

    // 1. Petición principal para actualizar la habitación en Supabase
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'Limpia/Lista', cleaning_started_at: null })
      .eq('id', room.id);

    if (error) {
      console.error('Error al actualizar:', error.message);
      alert(`No se pudo cambiar el estado: ${error.message}`);
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...room } : r)));
      return;
    }

    // 2. El historial (duración real y cumplimiento) lo registra automáticamente el
    //    trigger trg_rooms_log_historial en PostgreSQL al cambiar el estado.

    setToastMessage(
      `Habitación ${room.room_number} completada en ${formatDuration(durationMs)} ${
        cumplioSla ? '· Tiempo límite cumplido' : '· Superó el tiempo límite'
      }`
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Envía la violación del tiempo límite al webhook de n8n (una sola vez por habitación)
  const sendSlaWebhook = async (room: Room) => {
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || '';
    if (!webhookUrl) return;

    const cfg = typeConfigs[room.room_type || ''];
    const slaMin = cfg?.sla_min ?? 45;
    const elapsedMin = Math.floor(getElapsed(room.cleaning_started_at) / 60000);

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: 'sla_violacion',
          hotel_id: room.hotel_id,
          habitacion: room.room_number,
          zona: room.zone || '',
          room_type: room.room_type || 'Estándar',
          sla_min: slaMin,
          minutos_transcurridos: elapsedMin,
          minutos_excedidos: Math.max(0, elapsedMin - slaMin),
          timestamp: new Date().toISOString(),
        }),
        keepalive: true,
      });
    } catch (err) {
      console.error('Error al notificar la violación del tiempo límite a n8n:', err);
    }
  };

  // Helper para normalizar comparaciones de estado
  const isInProgress = (status: string) => {
    const st = (status || '').toLowerCase();
    return st === 'en limpieza' || st === 'in progress';
  };

  // Al pasar el tiempo límite de una habitación en progreso, notifica a n8n
  useEffect(() => {
    rooms.forEach((room) => {
      if (!isInProgress(room.status) || !room.cleaning_started_at) return;
      const cfg = typeConfigs[room.room_type || ''];
      const slaMs = (cfg?.sla_min ?? 45) * 60000;

      if (getElapsed(room.cleaning_started_at) > slaMs) {
        if (!slaNotifiedRef.current.has(room.id)) {
          slaNotifiedRef.current.add(room.id);
          sendSlaWebhook(room);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // Marca una notificación como leída y la quita del panel
  const handleDismissNotificacion = async (id: string) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
  };

  // Helper para normalizar comparaciones de estado
  const isSucia = (status: string) => {
    const st = (status || '').toLowerCase();
    return st === 'sucia' || st === 'dirty';
  };

  // Filtrado operativo
  const visibleRooms = rooms.filter((room) => isSucia(room.status) || isInProgress(room.status));

  const filteredRooms = visibleRooms.filter((room) => {
    if (selectedZone && room.zone !== selectedZone) return false;
    if (prioritariasOnly) {
      // Habitaciones marcadas como prioritarias desde Recepción (sucias o en proceso)
      if (room.is_priority) return true;
      // Además, limpiezas en curso que ya superaron el tiempo estándar
      if (room.cleaning_started_at) {
        const cfg = typeConfigs[room.room_type || ''];
        const stdMs = (cfg?.tiempo_estandar_min ?? 30) * 60000;
        return getElapsed(room.cleaning_started_at) > stdMs;
      }
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Cargando información del panel...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* NOTIFICACIONES DEL PANEL (n8n) */}
      {notificaciones.length > 0 && (
        <section className="space-y-2">
          {notificaciones.map((n) => (
            <div key={n.id} className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 flex items-start gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <BellRing className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{n.titulo}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{n.mensaje}</p>
              </div>
              <button
                onClick={() => handleDismissNotificacion(n.id)}
                className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 shrink-0"
                title="Marcar como leída"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* MÉTRICAS */}
      <section className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-[#131927] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
          <span className="text-[10px] text-slate-500 block mb-0.5">Pendientes</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">{visibleRooms.length}</span>
        </div>
        <div className="bg-white dark:bg-[#131927] p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/20 text-center shadow-sm">
          <span className="text-[10px] text-rose-600 block mb-0.5">Por Limpiar</span>
          <span className="text-lg font-bold text-rose-600">
            {visibleRooms.filter((r) => isSucia(r.status)).length}
          </span>
        </div>
        <div className="bg-white dark:bg-[#131927] p-2.5 rounded-xl border border-amber-200 dark:border-amber-500/20 text-center shadow-sm">
          <span className="text-[10px] text-amber-600 block mb-0.5">En Proceso</span>
          <span className="text-lg font-bold text-amber-600">
            {visibleRooms.filter((r) => isInProgress(r.status)).length}
          </span>
        </div>
      </section>

      {/* FILTROS DE ZONA + PRIORITARIAS */}
      <section className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
          <button
            onClick={() => setSelectedZone(null)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              selectedZone === null
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-[#131927] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Todas
          </button>
          {zonas.map((zona) => (
            <button
              key={zona}
              onClick={() => setSelectedZone(zona)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                selectedZone === zona
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white dark:bg-[#131927] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {zona}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPrioritariasOnly((prev) => !prev)}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 inline-flex items-center gap-1.5 ${
            prioritariasOnly
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-white dark:bg-[#131927] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <TriangleAlert className="w-3.5 h-3.5" />
          Prioritarias
        </button>
      </section>

      {/* LISTA DE HABITACIONES */}
      <main className="space-y-3">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            🎉 ¡Sin habitaciones pendientes!
          </div>
        ) : (
          filteredRooms.map((room) => {
            const cfg = typeConfigs[room.room_type || ''];
            const inProgress = isInProgress(room.status);
            const startedAt = room.cleaning_started_at;
            const elapsed = inProgress && startedAt ? getElapsed(startedAt) : 0;
            const stdMs = (cfg?.tiempo_estandar_min ?? 30) * 60000;
            const slaMs = (cfg?.sla_min ?? 45) * 60000;
            const overSla = elapsed > slaMs;
            const overStd = elapsed > stdMs || overSla;
            const timerColor = overSla
              ? 'text-rose-500'
              : overStd
                ? 'text-amber-500'
                : 'text-emerald-500';
            const progressColor = overSla
              ? 'bg-rose-500'
              : overStd
                ? 'bg-amber-500'
                : 'bg-emerald-500';
            const progressPct = Math.min(100, (elapsed / stdMs) * 100);

            return (
              <div
                key={room.id}
                className={`bg-white dark:bg-[#131927] rounded-2xl p-4 border shadow-sm ${
                  room.is_priority
                    ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-amber-100 dark:shadow-none'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{room.room_number}</span>
                    <span className="ml-2 text-xs text-slate-500">{room.room_type || 'Estándar'} • {room.zone || 'Piso 1'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {room.is_priority && (
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400" />
                        Prioritaria
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                      isSucia(room.status) ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {room.status}
                    </span>
                  </div>
                </div>

                {inProgress && (
                  <div className="mt-3 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-700/60 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <Timer className="w-3.5 h-3.5" />
                        Tiempo transcurrido
                      </span>
                      <span className={`font-mono font-bold text-sm ${timerColor}`}>
                        {formatDuration(elapsed)}
                      </span>
                    </div>

                    {/* Barra de progreso vs tiempo estándar */}
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressColor}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
                      <span>
                        Estándar: <strong>{cfg?.tiempo_estandar_min ?? 30} min</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        Tiempo Límite: <strong>{cfg?.sla_min ?? 45} min</strong>
                      </span>
                      {overSla && (
                        <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
                          <TriangleAlert className="w-3 h-3" /> Crítica
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  {isSucia(room.status) && (
                    <button
                      onClick={() => handleStartCleaning(room)}
                      className="w-full h-12 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"
                    >
                      <Clock className="w-4 h-4" /> Iniciar Limpieza
                    </button>
                  )}

                  {inProgress && (
                    <button
                      onClick={() => handleFinishCleaning(room)}
                      className="w-full h-12 bg-emerald-500 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Marcar Limpia / Lista
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* TOAST FLOTANTE */}
      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 bg-emerald-500 text-white p-3 rounded-xl text-xs font-semibold text-center shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}