'use client';

import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from '@/lib/notify-sound';
import { CheckCircle2, Clock, Timer, TriangleAlert, Star } from 'lucide-react';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase';

// ─── Server Time Sync ──────────────────────────────────────────────
async function getServerTimeOffset(): Promise<number | null> {
  const requestStartedAt = Date.now();

  try {
    const { data, error } = await supabase.rpc('get_server_time');
    const requestFinishedAt = Date.now();

    if (error || !data) return null;

    const serverMs = Date.parse(String(data));

    if (!Number.isFinite(serverMs)) {
      return null;
    }

    const localMidpoint =
      requestStartedAt + (requestFinishedAt - requestStartedAt) / 2;

    return serverMs - localMidpoint;
  } catch {
    return null;
  }
}

interface RoomTypeConfig {
  id: string;
  room_type: string;
  tiempo_estandar_min: number;
  sla_min: number;
}

interface Room {
  id: string;
  room_number: string;
  tipo_habitacion_id?: string | null;
  room_type_config?: RoomTypeConfig | null;
  zona_id?: string | null;
  zonas?: { nombre: string } | null;
  status: string;
  hotel_id: string;
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

const isSucia = (status: string) => {
  const st = (status || '').toLowerCase();
  return st === 'sucia' || st === 'dirty';
};

const isInProgress = (status: string) => {
  const st = (status || '').toLowerCase();
  return st === 'en limpieza' || st === 'in progress';
};

const fetchOwners = async (rooms: Room[]): Promise<Record<string, string | null>> => {
  const ids = rooms.filter((r) => isInProgress(r.status)).map((r) => r.id);
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from('ciclos_limpieza')
    .select('habitacion_id, usuario_id')
    .in('habitacion_id', ids)
    .is('finalizado_at', null);

  const owners: Record<string, string | null> = {};
  for (const row of data ?? []) {
    if (row.habitacion_id && row.usuario_id) {
      owners[row.habitacion_id] = row.usuario_id;
    }
  }
  return owners;
};

const refreshRoomOwner = async (roomId: string) => {
  const { data } = await supabase
    .from('ciclos_limpieza')
    .select('usuario_id')
    .eq('habitacion_id', roomId)
    .is('finalizado_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.usuario_id ?? null;
};

const fetchCleaningStart = async (roomId: string): Promise<number | null> => {
  const { data } = await supabase
    .from('ciclos_limpieza')
    .select('iniciado_at')
    .eq('habitacion_id', roomId)
    .is('finalizado_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const ms = data?.iniciado_at ? Date.parse(data.iniciado_at) : null;
  return Number.isFinite(ms) ? ms : null;
};

const fetchAllCleaningStarts = async (rooms: Room[]): Promise<Record<string, number>> => {
  const inProgressIds = rooms.filter((r) => isInProgress(r.status)).map((r) => r.id);
  if (inProgressIds.length === 0) return {};

  const { data } = await supabase
    .from('ciclos_limpieza')
    .select('habitacion_id, iniciado_at')
    .in('habitacion_id', inProgressIds)
    .is('finalizado_at', null);

  const starts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.habitacion_id && row.iniciado_at) {
      const ms = Date.parse(row.iniciado_at);
      if (Number.isFinite(ms)) {
        starts[row.habitacion_id] = ms;
      }
    }
  }
  return starts;
};

export default function LimpiezaMobilePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [owners, setOwners] = useState<Record<string, string | null>>({});
  const [cleaningStarts, setCleaningStarts] = useState<Record<string, number>>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [typeConfigs, setTypeConfigs] = useState<Record<string, TypeConfig>>({});
  const [loading, setLoading] = useState(true);
  const [zonas, setZonas] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [prioritariasOnly, setPrioritariasOnly] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const slaNotifiedRef = useRef<Set<string>>(new Set());
  const localStartRef = useRef<Record<string, number>>({});

  const [serverOffset, setServerOffset] = useState<number>(0);
  const [offsetReady, setOffsetReady] = useState(false);
  const [serverNow, setServerNow] = useState<number>(() => Date.now());

  const triggerNotification = (message: string) => {
    playNotificationSound();
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    let cancelled = false;

    const syncServerTime = async () => {
      const offset = await getServerTimeOffset();
      if (cancelled) return;

      if (offset === null) {
        setOffsetReady(false);
        return;
      }

      const now = Date.now() + offset;
      setServerOffset(offset);
      setServerNow(now);
      setOffsetReady(true);
    };

    syncServerTime();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!offsetReady) return;
    setServerNow(Date.now() + serverOffset);

    const tick = setInterval(() => {
      setServerNow(Date.now() + serverOffset);
    }, 1000);

    return () => clearInterval(tick);
  }, [serverOffset, offsetReady]);

  const isLimpiezaRole = userProfile?.role === 'limpieza';
  const myInProgressRooms = rooms.filter(
    (r) => isInProgress(r.status) && isLimpiezaRole && owners[r.id] === currentUserId
  );
  const hasActiveTask = myInProgressRooms.length > 0;
  const currentTaskRoom = myInProgressRooms[0] ?? null;

  // Registrar Token FCM para notificaciones Push
  const registerFcmToken = async (userId: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const messaging = getMessaging(firebaseApp);
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (token) {
            await supabase
              .from('profiles')
              .update({ fcm_token: token })
              .eq('id', userId);
          }
        }
      }
    } catch (err) {
      console.error('Error al solicitar token FCM:', err);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
        
        // Ejecutamos el registro de FCM
        registerFcmToken(user.id);

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

  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from('rooms')
        .select(`
          *,
          room_type_config:tipo_habitacion_id ( id, room_type, tiempo_estandar_min, sla_min ),
          zonas:zona_id ( nombre )
        `)
        .order('room_number', { ascending: true });

      if (data) {
        setRooms(data);
        const ownersMap = await fetchOwners(data);
        setOwners(ownersMap);
        const startsMap = await fetchAllCleaningStarts(data);
        setCleaningStarts(startsMap);
      }
      setLoading(false);
    };

    fetchRooms();

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        void fetchRooms();
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('pageshow', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('pageshow', handleResume);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('limpieza-rooms-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        async (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const rawRoom = payload.new as Room;
            
            const { data: updatedRoom } = await supabase
              .from('rooms')
              .select(`
                *,
                room_type_config:tipo_habitacion_id ( id, room_type, tiempo_estandar_min, sla_min ),
                zonas:zona_id ( nombre )
              `)
              .eq('id', rawRoom.id)
              .single();

            if (!updatedRoom) return;

            // Tipificamos payload.old para evitar el error de TypeScript
            const oldRecord = payload.old as Room | null;
            const prevStatus = oldRecord?.status;
            const newStatus = updatedRoom.status;

            setRooms((prev) => {
              const exists = prev.some((r) => r.id === updatedRoom.id);
              if (exists) {
                return prev.map((r) => {
                  if (r.id === updatedRoom.id) {
                    return {
                      ...r,
                      ...updatedRoom,
                      room_type_config: updatedRoom.room_type_config || r.room_type_config,
                      zonas: updatedRoom.zonas || r.zonas,
                    };
                  }
                  return r;
                });
              } else {
                return [...prev, updatedRoom];
              }
            });

            if (isInProgress(newStatus) && prevStatus !== 'En Limpieza') {
              const isLocalStart = localStartRef.current[updatedRoom.id] != null;

              if (!isLocalStart) {
                Promise.all([
                  refreshRoomOwner(updatedRoom.id),
                  fetchCleaningStart(updatedRoom.id)
                ]).then(([ownerId, iniciadoAt]) => {
                  if (ownerId) {
                    setOwners((prev) => ({ ...prev, [updatedRoom.id]: ownerId }));
                  }
                  if (iniciadoAt) {
                    setCleaningStarts((prev) => ({ ...prev, [updatedRoom.id]: iniciadoAt }));
                  }
                });
              } else {
                delete localStartRef.current[updatedRoom.id];
              }
            }

            if (prevStatus === 'En Limpieza' && !isInProgress(newStatus)) {
              setCleaningStarts((prev) => {
                const next = { ...prev };
                delete next[updatedRoom.id];
                return next;
              });
              setOwners((prev) => {
                const next = { ...prev };
                delete next[updatedRoom.id];
                return next;
              });
              delete localStartRef.current[updatedRoom.id];
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRoom = payload.old as Room;
            setRooms((prev) => prev.filter((r) => r.id !== oldRoom.id));
          }
        }
      )
      // ... resto del código
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const newNotif = payload.new as { 
            message: string; 
            target_role?: string; 
            user_id?: string | null;
            kind?: 'status' | 'priority' | 'info' 
          };

          if (newNotif && newNotif.message) {
            const target = newNotif.target_role ? newNotif.target_role.toLowerCase().trim() : '';
            
            if (target === 'limpieza') {
              const { data: { user } } = await supabase.auth.getUser();
              const activeUserId = user?.id ?? currentUserId;

              const isForMe = !newNotif.user_id || 
                              newNotif.user_id === 'null' || 
                              newNotif.user_id === activeUserId;

              if (isForMe) {
                triggerNotification(newNotif.message);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const getCleaningStart = (roomId: string): number | null => {
    return cleaningStarts[roomId] ?? null;
  };

  const getElapsed = (roomId: string): number => {
    const startedMs = getCleaningStart(roomId);
    if (startedMs === null) return 0;
    const elapsed = serverNow - startedMs;
    return elapsed > 0 ? elapsed : 0;
  };

  const formatDuration = (ms: number): string => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStartCleaning = async (room: Room) => {
    if (!offsetReady) {
      setToastMessage('Sincronizando la hora del servidor. Intenta de nuevo en un momento.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (hasActiveTask && isLimpiezaRole) {
      setToastMessage(
        `Primero finaliza la limpieza de la habitación ${currentTaskRoom?.room_number ?? ''} ` +
          'para poder iniciar otra.'
      );
      return;
    }

    const serverStartMs = serverNow;
    const serverStartIso = new Date(serverStartMs).toISOString();

    localStartRef.current[room.id] = serverStartMs;

    flushSync(() => {
      setCleaningStarts((prev) => ({ ...prev, [room.id]: serverStartMs }));
      setRooms((prev) =>
        prev.map((r) =>
          r.id === room.id ? { ...r, status: 'En Limpieza' } : r
        )
      );
      if (currentUserId) {
        setOwners((prev) => ({ ...prev, [room.id]: currentUserId }));
      }
    });

    const { error: cicloError } = await supabase
      .from('ciclos_limpieza')
      .update({
        usuario_id: currentUserId,
        iniciado_at: serverStartIso,
      })
      .eq('habitacion_id', room.id)
      .is('finalizado_at', null);

    const { error: roomError } = await supabase
      .from('rooms')
      .update({ status: 'En Limpieza' })
      .eq('id', room.id);

    if (roomError || cicloError) {
      console.error('Error al iniciar limpieza:', roomError?.message || cicloError?.message);
      flushSync(() => {
        setCleaningStarts((prev) => { const n = { ...prev }; delete n[room.id]; return n; });
        setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, status: room.status } : r));
        setOwners((prev) => { const n = { ...prev }; delete n[room.id]; return n; });
      });
      delete localStartRef.current[room.id];
      alert(`No se pudo iniciar la limpieza`);
      return;
    }

    setTimeout(() => delete localStartRef.current[room.id], 3000);
  };

  const getRoomType = (room: Room): string => room.room_type_config?.room_type || 'Estándar';
  const getRoomZone = (room: Room): string => room.zonas?.nombre || 'Piso 1';
  const getTypeConfig = (room: Room) => typeConfigs[getRoomType(room)];

  const handleFinishCleaning = async (room: Room) => {
    flushSync(() => {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      setOwners((prev) => {
        const next = { ...prev };
        delete next[room.id];
        return next;
      });
      setCleaningStarts((prev) => {
        const next = { ...prev };
        delete next[room.id];
        return next;
      });
    });

    const { error } = await supabase
      .from('rooms')
      .update({ status: 'Limpia/Lista' })
      .eq('id', room.id);

    if (error) {
      console.error('Error al finalizar limpieza:', error.message);
    } else {
      setToastMessage(`Habitación ${room.room_number} completada exitosamente.`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const sendSlaWebhook = async (room: Room) => {
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || '';
    const ntfyTopic = process.env.NTFY_TOPIC || 'apphr-hotel-152';
    const cfg = getTypeConfig(room);
    const slaMin = cfg?.sla_min ?? 45;
    const authoritativeStart = await fetchCleaningStart(room.id);
    if (authoritativeStart === null) return;

    const authoritativeElapsed = serverNow - authoritativeStart;
    if (authoritativeElapsed <= slaMin * 60000) return;

    const elapsedMin = Math.floor(authoritativeElapsed / 60000);
    const assignedUserId = owners[room.id] || currentUserId;
    slaNotifiedRef.current.add(room.id);

    try {
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'sla_violacion',
            hotel_id: room.hotel_id,
            habitacion: room.room_number,
            zona: getRoomZone(room),
            room_type: getRoomType(room),
            sla_min: slaMin,
            minutos_transcurridos: elapsedMin,
            minutos_excedidos: Math.max(0, elapsedMin - slaMin),
            user_id: assignedUserId,
            timestamp: new Date().toISOString(),
          }),
          keepalive: true,
        });
      }

      await fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: 'POST',
        headers: {
          Title: '⚠️ Alerta de limpieza',
          Priority: 'urgent',
          Tags: 'warning',
        },
        body: `Habitación ${room.room_number}: excedió el límite de ${slaMin} minutos.`,
      });
    } catch (err) {
      console.error('Error al notificar la violación del tiempo límite:', err);
    }
  };

  useEffect(() => {
    if (!offsetReady) return;

    rooms.forEach((room) => {
      if (!isInProgress(room.status) || !getCleaningStart(room.id)) return;
      const cfg = getTypeConfig(room);
      const slaMs = (cfg?.sla_min ?? 45) * 60000;

      if (getElapsed(room.id) > slaMs) {
        if (!slaNotifiedRef.current.has(room.id)) {
          sendSlaWebhook(room);
        }
      }
    });
  }, [serverNow]);

  const visibleRooms = rooms.filter((room) => {
    if (isSucia(room.status)) return true;
    if (isInProgress(room.status)) {
      return isLimpiezaRole ? owners[room.id] === currentUserId : true;
    }
    return false;
  });

  const filteredRooms = visibleRooms.filter((room) => {
    if (selectedZone && getRoomZone(room) !== selectedZone) return false;
    if (prioritariasOnly) {
      if (room.is_priority) return true;
      if (getCleaningStart(room.id)) {
        const cfg = getTypeConfig(room);
        const stdMs = (cfg?.tiempo_estandar_min ?? 30) * 60000;
        return getElapsed(room.id) > stdMs;
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
        <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0 pr-4 pb-2">
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

      {/* AVISO TAREA ÚNICA */}
      {isLimpiezaRole && hasActiveTask && currentTaskRoom && (
        <section className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 rounded-xl p-3 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <TriangleAlert className="w-4 h-4 shrink-0" />
          <span>
            Limpieza en curso: Hab. {currentTaskRoom.room_number}. Finalízala antes de iniciar otra
            tarea.
          </span>
        </section>
      )}

      {/* LISTA DE HABITACIONES */}
      <main className="space-y-3">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            🎉 ¡Sin habitaciones pendientes!
          </div>
        ) : (
          filteredRooms.map((room) => {
            const cfg = getTypeConfig(room);
            const inProgress = isInProgress(room.status);
            const elapsed = inProgress ? getElapsed(room.id) : 0;
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
            const progressPct = inProgress && stdMs > 0 ? Math.min(100, (elapsed / stdMs) * 100) : 0;

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
                    <span className="ml-2 text-xs text-slate-500">{getRoomType(room)} • {getRoomZone(room)}</span>
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
                      disabled={isLimpiezaRole && hasActiveTask}
                      className={`w-full h-12 font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${
                        isLimpiezaRole && hasActiveTask
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 text-white active:scale-95'
                      }`}
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

      {/* TOAST FLOTANTE DE NOTIFICACIONES */}
      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 bg-emerald-500 text-white p-3 rounded-xl text-xs font-semibold text-center shadow-lg animate-bounce">
          🔔 {toastMessage}
        </div>
      )}
    </div>
  );
}