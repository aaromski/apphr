'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, Timer, TriangleAlert, User } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  room_type?: string;
  zone?: string;
  status: string;
  hotel_id: string;
  cleaning_timer?: string;
  cleaning_started_at?: string | null;
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

export default function LimpiezaMobilePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [typeConfigs, setTypeConfigs] = useState<Record<string, TypeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'Todas' | 'Piso 1' | 'Piso 2' | 'Prioritarias'>('Todas');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reloj base para todos los cronómetros (tick cada segundo)
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    // 1. Cargar usuario activo y su perfil
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

          // 1.1 Cargar la configuración de tiempos estándar / SLA por tipo de habitación
          if (profile.hotel_id) {
            const { data: cfg } = await supabase
              .from('room_type_config')
              .select('room_type, tiempo_estandar_min, sla_min')
              .eq('hotel_id', profile.hotel_id);

            if (cfg) {
              setTypeConfigs(
                Object.fromEntries(
                  cfg.map((c) => [c.room_type, c]) as [string, TypeConfig][]
                )
              );
            }
          }
        }
      }
    };

    // 2. Carga inicial de habitaciones
    const fetchRooms = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true });

      if (data) setRooms(data);
      setLoading(false);
    };

    fetchUserData();
    fetchRooms();

    // 3. Suscripción en tiempo real
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

    return () => {
      supabase.removeChannel(channel);
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

  // ---- Completar limpieza: registra duración real y SLA cumplido ----
  const handleFinishCleaning = async (room: Room) => {
    const finishedAt = new Date().toISOString();
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

    // 2. Registrar en el historial con duración real y resultado de SLA
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error: historyError } = await supabase
        .from('historial_estados_habitacion')
        .insert({
          hotel_id: room.hotel_id,
          habitacion_id: room.id,
          usuario_id: user.id,
          estado_anterior: 'En Limpieza',
          estado_nuevo: 'Limpia/Lista',
          fecha_cambio: finishedAt,
          duracion_min: durationMin,
          cumplio_sla: cumplioSla,
        });

      if (historyError) {
        console.error('Error al registrar historial:', historyError.message);
      }
    }

    setToastMessage(
      `Habitación ${room.room_number} completada en ${formatDuration(durationMs)} ${
        cumplioSla ? '· SLA cumplido' : '· Superó el SLA'
      }`
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper para normalizar comparaciones de estado
  const isSucia = (status: string) => {
    const st = (status || '').toLowerCase();
    return st === 'sucia' || st === 'dirty';
  };

  const isInProgress = (status: string) => {
    const st = (status || '').toLowerCase();
    return st === 'en limpieza' || st === 'in progress';
  };

  // Filtrado operativo
  const visibleRooms = rooms.filter((room) => isSucia(room.status) || isInProgress(room.status));

  const filteredRooms = visibleRooms.filter((room) => {
    if (filter === 'Piso 1') return room.zone === 'Piso 1';
    if (filter === 'Piso 2') return room.zone === 'Piso 2';
    if (filter === 'Prioritarias') {
      if (!room.cleaning_started_at) return false;
      const cfg = typeConfigs[room.room_type || ''];
      const stdMs = (cfg?.tiempo_estandar_min ?? 30) * 60000;
      return getElapsed(room.cleaning_started_at) > stdMs;
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
      {/* TARJETA DEL USUARIO AUTENTICADO */}
      <section className="bg-white dark:bg-[#131927] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              {userProfile?.nombre || 'Cargando...'}
            </h2>
            <p className="text-[11px] text-slate-500 capitalize leading-tight mt-0.5">
              {userProfile?.role || 'Personal de Limpieza'}
            </p>
          </div>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="En línea" />
      </section>

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

      {/* FILTROS DE ZONA */}
      <section className="flex gap-2 overflow-x-auto no-scrollbar">
        {(['Todas', 'Piso 1', 'Piso 2', 'Prioritarias'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              filter === tab
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-[#131927] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
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
              <div key={room.id} className="bg-white dark:bg-[#131927] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{room.room_number}</span>
                    <span className="ml-2 text-xs text-slate-500">{room.room_type || 'Estándar'} • {room.zone || 'Piso 1'}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                    isSucia(room.status) ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {room.status}
                  </span>
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
                        Límite SLA: <strong>{cfg?.sla_min ?? 45} min</strong>
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