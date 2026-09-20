'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from '@/lib/notify-sound';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Building2, 
  Search, 
  Bell, 
  Clock, 
  ChevronDown,
  LayoutGrid,
  CheckCircle2,
  X,
  LogOut,
  TriangleAlert,
  Star,
  DoorOpen,
  BellRing,
  CheckCheck,
  Trash2,
  Radio,
  Menu
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

// ─── Server Time Sync ───────────────────────────────────────────
// Offset medido una vez al cargar: serverTime - localTime
async function getServerTimeOffset(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_server_time');
    if (!error && data) {
      const serverMs = Date.parse(data);
      if (Number.isFinite(serverMs)) {
        return serverMs - Date.now(); // offset = server - local
      }
    }
  } catch {}
  // Fallback: query ligera a una tabla pequeña para medir latencia y obtener now()
  const start = Date.now();
  const { data, error } = await supabase.from('ciclos_limpieza').select('id').limit(1);
  const end = Date.now();
  if (!error && data) {
    const latency = end - start;
    return latency / 2;
  }
  return 0;
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
  status: 'Disponible' | 'Ocupada' | 'Sucia' | 'En Limpieza' | 'Limpia/Lista' | 'Mantenimiento' | string;
  tipo_habitacion_id?: string | null;
  room_type_config?: RoomTypeConfig | null;
  zona_id?: string | null;
  zonas?: { nombre: string } | null;
  hotel_id?: string;
  is_priority?: boolean;
}

// Entrada del historial de notificaciones acumulado en el panel de recepción
interface NotificationItem {
  id: string;
  message: string;
  kind: 'status' | 'priority' | 'info';
  unread: boolean;
  timestamp: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const roomsRef = useRef<Room[]>([]);
  // cleaningStarts[habitacion_id] = iniciado_at from ciclos_limpieza (ISO string)
  const [cleaningStarts, setCleaningStarts] = useState<Record<string, number>>({});
  const lastUserChangeRef = useRef<{ roomId: string; newStatus: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; visible: boolean } | null>(null);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const bellMenuRef = useRef<HTMLDivElement>(null);

  // Mobile responsive states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Mensaje informativo SOLO cuando el estado operativo real de la habitación cambió.
  // Los casos especiales (fin de limpieza, ocupación, disponibilidad) reemplazan al genérico.
  const buildStatusChangedMessage = (prevRoom: Room, nextRoom: Room): string => {
    if (prevRoom.status === 'En Limpieza' && nextRoom.status === 'Limpia/Lista') {
      return `Habitación ${nextRoom.room_number} está lista`;
    }
    if (prevRoom.status === 'Limpia/Lista' && nextRoom.status === 'Ocupada') {
      return `Habitación ${nextRoom.room_number} ahora Ocupada (ingreso programado)`;
    }
    if (prevRoom.status === 'Limpia/Lista' && nextRoom.status === 'Disponible') {
      return `Habitación ${nextRoom.room_number} queda Disponible y lista`;
    }
    return `Habitación ${nextRoom.room_number} cambió a: ${nextRoom.status}`;
  };

  // Realtime puede entregar el registro anterior (payload.old) como objeto, como string
  // base64/JSON, o no entregarlo (RLS). Esta función lo normaliza y valida antes de usarlo.
  const parseRealtimeOldRoom = (raw: unknown): Room | null => {
    if (!raw) return null;

    let candidate: unknown = raw;
    if (typeof raw === 'string') {
      try {
        candidate = JSON.parse(atob(raw));
      } catch {
        try {
          candidate = JSON.parse(raw);
        } catch {
          return null;
        }
      }
    }

    if (candidate && typeof candidate === 'object') {
      const room = candidate as Room;
      if (typeof room.id === 'string' && typeof room.status === 'string') return room;
    }
    return null;
  };

  // Publica una notificación: actualiza el toast flotante y acumula el historial.
  const publishNotification = useCallback((message: string, kind: NotificationItem['kind'] = 'info') => {
    // Representación sonora de que llegó una notificación
    playNotificationSound();

    setNotification({ message, visible: true });
    setNotificationsList((prev) =>
      [
        {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          message,
          kind,
          unread: true,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 40)
    );
  }, []);

  const markAllNotificationsRead = () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearNotifications = () => {
    setNotificationsList([]);
  };

  const unreadCount = notificationsList.filter((n) => n.unread).length;

  // Estados para el perfil del usuario activo (Recepcionista)
  const [userData, setUserData] = useState<{ nombre: string; role: string; email: string; hotel_id?: string } | null>(null);

  // Configuración de tiempos límite por tipo de habitación + reloj base para los temporizadores
  const [typeConfigs, setTypeConfigs] = useState<Record<string, { tiempo_estandar_min: number; sla_min: number }>>({});

  // ─── Server Time Sync ───────────────────────────────────────────
  // Offset medido una vez al cargar: serverTime - localTime
  const [serverOffset, setServerOffset] = useState<number>(0);
  const [offsetReady, setOffsetReady] = useState(false);

  // Tiempo "servidor" actual = localNow + offset. Se actualiza cada segundo.
  const [serverNow, setServerNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    getServerTimeOffset().then((offset) => {
      if (!cancelled) {
        setServerOffset(offset);
        setOffsetReady(true);
      }
    }).catch(() => {
      if (!cancelled) setOffsetReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Reloj base "servidor" (tick cada segundo)
  useEffect(() => {
    if (!offsetReady) return;
    const tick = setInterval(() => setServerNow(Date.now() + serverOffset), 1000);
    return () => clearInterval(tick);
  }, [serverOffset, offsetReady]);

  // Para compatibilidad con código existente que usa `now`
  const now = serverNow;

  // Marca de tiempo relativa para el historial (se mantiene fresca por el reloj base `serverNow`)
  const formatRelativeTime = (ts: number) => {
    const diff = serverNow - ts;
    if (diff < 60000) return 'ahora';
    const min = Math.floor(diff / 60000);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h}h`;
    return new Date(ts).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
  };

  const formatDuration = (ms: number): string => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Cierra el menú de notificaciones cuando se hace clic fuera de él
  useEffect(() => {
    if (!showNotificationsMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (bellMenuRef.current && !bellMenuRef.current.contains(event.target as Node)) {
        setShowNotificationsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotificationsMenu]);

  useEffect(() => {
    async function fetchInitialData() {
      // 1. Obtener sesión de usuario actual y sus datos de la tabla profiles
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombre, role, email, hotel_id')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUserData(profile);
          // Cargar la configuración de tiempos límite por tipo de habitación del hotel
          if (profile.hotel_id) {
            const { data: cfg } = await supabase
              .from('room_type_config')
              .select('room_type, tiempo_estandar_min, sla_min')
              .eq('hotel_id', profile.hotel_id);

            if (cfg) {
              setTypeConfigs(
                Object.fromEntries(
                  cfg.map((c) => [c.room_type, c]) as [string, { tiempo_estandar_min: number; sla_min: number }][]
                )
              );
            }
          }
        } else {
          setUserData({
            nombre: session.user.email?.split('@')[0] || 'Recepcionista',
            role: 'Recepcionista',
            email: session.user.email || '',
          });
        }
      }

      // 2. Obtener habitaciones
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_type_config:tipo_habitacion_id ( id, room_type, tiempo_estandar_min, sla_min ),
          zonas:zona_id ( nombre )
        `)
        .order('room_number', { ascending: true });
      if (error) {
        console.error('Error cargando habitaciones:', error.message);
      } else {
        setRooms(data || []);
        roomsRef.current = data || [];
        // Obtener inicios de limpieza desde ciclos_limpieza
        const inProgressIds = (data || []).filter((r) => r.status === 'En Limpieza').map((r) => r.id);
        if (inProgressIds.length > 0) {
          const { data: startsData } = await supabase
            .from('ciclos_limpieza')
            .select('habitacion_id, iniciado_at')
            .in('habitacion_id', inProgressIds)
            .is('finalizado_at', null);
          const starts: Record<string, number> = {};
          for (const row of startsData ?? []) {
            if (row.habitacion_id && row.iniciado_at) {
              const ms = Date.parse(row.iniciado_at);
              if (Number.isFinite(ms)) {
                starts[row.habitacion_id] = ms;
              }
            }
          }
          setCleaningStarts(starts);
        }
      }
      setLoading(false);
    }
    fetchInitialData();

    const channel = supabase
      .channel('reception-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedRoom = payload.new as Room;
            const previousRoom =
              parseRealtimeOldRoom(payload.old) ??
              roomsRef.current.find((r) => r.id === updatedRoom.id);

            setRooms((prev) =>
              prev.map((room) => (room.id === updatedRoom.id ? updatedRoom : room))
            );
            roomsRef.current = roomsRef.current.map((room) =>
              room.id === updatedRoom.id ? updatedRoom : room
            );

            if (previousRoom && previousRoom.status !== updatedRoom.status) {
              const lastChange = lastUserChangeRef.current;
              if (!(lastChange && lastChange.roomId === updatedRoom.id && lastChange.newStatus === updatedRoom.status)) {
                publishNotification(buildStatusChangedMessage(previousRoom, updatedRoom), 'status');
              }
              if (lastChange && lastChange.roomId === updatedRoom.id) {
                lastUserChangeRef.current = null;
              }
            }

            if (updatedRoom.status === 'En Limpieza' && previousRoom?.status !== 'En Limpieza') {
              supabase
                .from('ciclos_limpieza')
                .select('iniciado_at')
                .eq('habitacion_id', updatedRoom.id)
                .is('finalizado_at', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
                .then(({ data }) => {
                  const ms = data?.iniciado_at ? Date.parse(data.iniciado_at) : null;
                  if (ms && Number.isFinite(ms)) {
                    setCleaningStarts((prev) => ({ ...prev, [updatedRoom.id]: ms }));
                  }
                });
            }

            if (previousRoom?.status === 'En Limpieza' && updatedRoom.status !== 'En Limpieza') {
              setCleaningStarts((prev) => {
                const next = { ...prev };
                delete next[updatedRoom.id];
                return next;
              });
            } else if (
              previousRoom &&
              Boolean(previousRoom.is_priority) !== Boolean(updatedRoom.is_priority)
            ) {
              publishNotification(
                `Habitación ${updatedRoom.room_number} ${
                  updatedRoom.is_priority
                    ? 'marcada como prioritaria'
                    : ': prioridad removida'
                }`,
                'priority'
              );
            }

            if (previousRoom && previousRoom.status === 'Ocupada' && updatedRoom.status === 'Sucia') {
              sendCheckoutWebhook(updatedRoom);
            }
          } else if (payload.eventType === 'INSERT') {
            setRooms((prev) => [...prev, payload.new as Room]);
            roomsRef.current = [...roomsRef.current, payload.new as Room];
          } else if (payload.eventType === 'DELETE') {
            const deletedRoom = parseRealtimeOldRoom(payload.old);
            if (deletedRoom) {
              setRooms((prev) => prev.filter((room) => room.id !== deletedRoom.id));
              roomsRef.current = roomsRef.current.filter((room) => room.id !== deletedRoom.id);
            }
          }
        }
      )
      // 👇 SECCIÓN AÑADIDA: Escucha de la tabla notifications en Realtime para n8n 👇
      .on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'notifications' },
  (payload) => {
    const newNotif = payload.new as { 
      message: string; 
      target_role?: string; 
      kind?: 'status' | 'priority' | 'info' 
    };

    if (newNotif && newNotif.message) {
      // Validamos estrictamente que la notificación sea para recepción
      const target = newNotif.target_role ? newNotif.target_role.toLowerCase().trim() : '';
      
      if (target === 'recepcion') {
        publishNotification(newNotif.message, newNotif.kind || 'priority');
      }
    }
  }
)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [publishNotification]);

  const updateRoomStatus = async (room: Room, newStatus: string) => {
    lastUserChangeRef.current = { roomId: room.id, newStatus };
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, status: newStatus } : r))
    );

    const { error } = await supabase.from('rooms').update({ status: newStatus }).eq('id', room.id);
    if (error) {
      console.error('Error actualizando estado:', error.message);
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, status: room.status } : r))
      );
      lastUserChangeRef.current = null;
      return;
    }
  };

  const sendCheckoutWebhook = async (room: Room) => {
    try {
      await fetch('/api/webhook/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: 'check_out',
          hotel_id: room.hotel_id,
          habitacion: room.room_number,
          zona: room.zonas?.nombre || '',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Error al notificar el check-out:', err);
    }
  };

  const handleCheckout = async (room: Room) => {
    if (room.status !== 'Ocupada') return;

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('rooms')
      .update({ 
        check_out_at: nowIso,
        status: 'Sucia' 
      })
      .eq('id', room.id);

    if (error) {
      console.error('Error al registrar check-out:', error.message);
      return;
    }

    await sendCheckoutWebhook(room);
  };

  const receptionTransitions: Record<string, string[]> = {
    Disponible: ['Ocupada', 'Mantenimiento'],
    Ocupada: ['Sucia', 'Mantenimiento'],
    Mantenimiento: ['Disponible', 'Sucia', 'Ocupada'],
    Sucia: [],
    'En Limpieza': [],
    'Limpia/Lista': ['Ocupada'],
  };

  const togglePriority = async (room: Room) => {
    const nextPriority = !room.is_priority;

    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, is_priority: nextPriority } : r))
    );

    const { error } = await supabase
      .from('rooms')
      .update({ is_priority: nextPriority })
      .eq('id', room.id);

    if (error) {
      console.error('Error actualizando prioridad:', error.message);
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, is_priority: room.is_priority } : r))
      );
      return;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const counts = {
    disponibles: rooms.filter(r => r.status === 'Disponible').length,
    ocupadas: rooms.filter(r => r.status === 'Ocupada').length,
    limpieza: rooms.filter(r => r.status === 'En Limpieza').length,
    sucias: rooms.filter(r => r.status === 'Sucia' || r.status === 'Dirty').length,
    limpiaLista: rooms.filter(r => r.status === 'Limpia/Lista').length,
    mantenimiento: rooms.filter(r => r.status === 'Mantenimiento').length,
  };

  const filteredRooms = rooms.filter(room => {
    const matchesFilter = activeFilter === 'Todos' || room.status === activeFilter;
    const matchesSearch = room.room_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getInitials = (name?: string) => {
    if (!name) return 'RC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatTimer = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-200 font-sans flex flex-col transition-colors duration-300">
      
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#111625]/80 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <button 
            className="lg:hidden p-2 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-500 transition-colors shadow-sm"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-wide">AppHR</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Grand Hotel Guayana</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            Sincronización en Realtime Activa
          </div>

          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar habitación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-700/80 rounded-xl py-1.5 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 w-48 focus:w-64 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <ThemeToggle />

          <div className="relative" ref={bellMenuRef}>
            <button
              onClick={() => setShowNotificationsMenu((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={showNotificationsMenu}
              aria-label="Notificaciones"
              className={`p-2 rounded-lg transition-colors relative ${
                showNotificationsMenu
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="w-2 h-2 bg-indigo-500 rounded-full absolute top-1.5 right-1.5 animate-pulse" />
              )}
            </button>

            {showNotificationsMenu && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-[22rem] bg-white/95 dark:bg-[#111625]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 z-50 overflow-hidden">
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
                      onClick={markAllNotificationsRead}
                      disabled={unreadCount === 0}
                      title="Marcar todo como leído"
                      className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                    <button
                      onClick={clearNotifications}
                      disabled={notificationsList.length === 0}
                      title="Limpiar historial"
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto overscroll-contain">
                  {notificationsList.length === 0 ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-2 text-center px-6">
                      <BellRing className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        No hay notificaciones recientes
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {notificationsList.map((item) => (
                        <li
                          key={item.id}
                          className={`px-4 py-3 flex items-start gap-3 transition-colors ${
                            item.unread
                              ? 'bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]'
                              : ''
                          } hover:bg-slate-50 dark:hover:bg-slate-800/40`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              item.kind === 'priority'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-indigo-500/10 text-indigo-500'
                            }`}
                          >
                            {item.kind === 'priority' ? (
                              <Star className="w-4 h-4" />
                            ) : (
                              <Building2 className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs leading-snug ${
                                item.unread
                                  ? 'font-semibold text-slate-900 dark:text-white'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {item.message}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Radio className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {formatRelativeTime(item.timestamp)} · Realtime
                              </span>
                            </div>
                          </div>
                          {item.unread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 dark:bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 overflow-hidden flex items-center justify-center border border-indigo-500/30 text-xs font-bold">
              {getInitials(userData?.nombre)}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-900 dark:text-white leading-none">
                {userData?.nombre || 'Cargando...'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                {userData?.role || 'Recepcionista'}
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="text-slate-400 hover:text-red-500 transition-colors p-1 ml-1" 
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 lg:px-6 py-4 lg:py-6 max-w-[1600px] w-full mx-auto">
        <button 
          className="lg:hidden w-full mb-4 bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors"
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          aria-expanded={mobileFiltersOpen}
        >
          <span className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            Filtros y Contadores
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 ${mobileFiltersOpen ? 'flex' : 'hidden'} lg:flex`}>
          <div className="flex items-center gap-3 flex-wrap">
            <button className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors">
              <LayoutGrid className="w-3.5 h-3.5" />
              Todas las Zonas
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-1.5 bg-white dark:bg-[#111625] p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm overflow-x-auto pb-1 no-scrollbar">
              {['Todos', 'Disponible', 'Ocupada', 'Sucia', 'En Limpieza', 'Mantenimiento'].map((status) => (
                <button
                  key={status}
                  onClick={() => { setActiveFilter(status); setMobileFiltersOpen(false); }}
                  className={`px-3 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeFilter === status
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800/80 p-1.5 rounded-xl shadow-sm flex-wrap">
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.disponibles}</strong> Disponibles
            </span>
            <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.ocupadas}</strong> Ocupadas
            </span>
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.sucias}</strong> Sucias
            </span>
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.limpieza}</strong> En Limpieza
            </span>
            <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.limpiaLista}</strong> Limpia/Lista
            </span>
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.mantenimiento}</strong> Mantenimiento
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
            Vista de Planta Principal
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando {filteredRooms.length} habitaciones
          </span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-xs">Cargando habitaciones...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {filteredRooms.map((room) => {
              const statusStyles: Record<string, string> = {
                Disponible: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                Ocupada: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                Sucia: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700',
                Dirty: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700',
                'En Limpieza': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                'Limpia/Lista': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                Mantenimiento: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
              };

              const startedMs = cleaningStarts[room.id];
              const roomTypeName = room.room_type_config?.room_type || 'Estándar';
              const slaMin = typeConfigs[roomTypeName]?.sla_min ?? 45;
              const elapsed = room.status === 'En Limpieza' && startedMs
                ? Math.max(0, now - startedMs)
                : 0;
              const isCritical = room.status === 'En Limpieza' && elapsed > slaMin * 60000;

              return (
                <div
                  key={room.id}
                  className={`bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all hover:shadow-xl relative group shadow-sm ${
                    isCritical
                      ? 'ring-2 ring-rose-500/70 border-rose-500 animate-pulse'
                      : room.is_priority
                        ? 'border-amber-400 shadow-amber-100 dark:shadow-none ring-2 ring-amber-400/50'
                        : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                          {room.room_number}
                        </span>
                        {room.is_priority && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCheckout(room)}
                          disabled={room.status !== 'Ocupada'}
                          title={
                            room.status === 'Ocupada'
                              ? 'Registrar Check-Out (la habitación quedará Sucia)'
                              : 'Check-Out disponible solo en habitaciones Ocupadas'
                          }
                          className={`p-1.5 rounded-lg transition-all ${
                            room.status === 'Ocupada'
                              ? 'text-cyan-500 hover:bg-cyan-500/10'
                              : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50'
                          }`}
                        >
                          <DoorOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => togglePriority(room)}
                          title={room.is_priority ? 'Quitar prioridad' : 'Marcar como prioritaria'}
                          aria-pressed={Boolean(room.is_priority)}
                          className={`p-1.5 rounded-lg transition-all ${
                            room.is_priority
                              ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'
                              : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-500/10'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${room.is_priority ? 'fill-amber-400' : 'fill-transparent'}`} />
                        </button>
                        <select
                          value={room.status}
                          onChange={(e) => updateRoomStatus(room, e.target.value)}
                          disabled={(receptionTransitions[room.status] || []).length === 0}
                          title={
                            (receptionTransitions[room.status] || []).length === 0
                              ? 'Recepción no puede cambiar esta habitación'
                              : 'Cambiar estado de la habitación'
                          }
                          className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 font-semibold text-slate-700 dark:text-slate-300 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value={room.status}>{room.status}</option>
                          {(receptionTransitions[room.status] || []).map((dest) => (
                            <option key={dest} value={dest}>
                              {dest}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/50">
                        {room.room_type_config?.room_type || 'Estándar'}
                      </span>
                      {room.is_priority && (
                        <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400" />
                          Prioritaria
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusStyles[room.status] || 'bg-slate-100 text-slate-600'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {room.status}
                    </span>

                    {room.status === 'En Limpieza' && startedMs ? (
                      <span
                        className={`text-[11px] font-bold flex items-center gap-1 ${
                          isCritical
                            ? 'text-rose-500 animate-pulse'
                            : 'text-amber-500 dark:text-amber-400'
                        }`}
                        title={`Limpieza en curso • Tiempo Límite: ${slaMin} min`}
                      >
                        {isCritical ? <TriangleAlert className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                        {formatTimer(elapsed)}
                        {isCritical && (
                          <span className="uppercase text-[9px] tracking-wide">Tiempo excedido</span>
                        )}
                      </span>
                    ) : cleaningStarts[room.id] ? (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(now - cleaningStarts[room.id])}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {notification && (
        <div className="fixed bottom-6 right-6 bg-white dark:bg-[#111625] border border-emerald-500/30 p-4 rounded-2xl shadow-2xl flex items-start gap-3 max-w-sm z-50 animate-bounce">
          <div className="w-7 h-7 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{notification.message}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Actualizado vía Realtime</p>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}