'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  Award,
  Shield,
  Bell,
  Hotel,
  UserCheck,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Target,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Inbox,
  TriangleAlert,
  Info,
  X,
  User,
} from 'lucide-react';

interface UserProfile {
  id: string;
  nombre: string | null;
  email: string;
  role: string;
  hotel_id: string;
  hotels?: {
    name: string;
  };
}

interface CicloLimpieza {
  id: string;
  habitacion_id: string;
  room_number: string;
  room_type: string;
  zone: string | null;
  usuario_id: string | null;
  personal_nombre: string | null;
  estado_origen: string;
  sucia_at: string | null;
  iniciado_at: string | null;
  finalizado_at: string;
  duracion_min: number | null;
  sla_min: number | null;
  cumplio_sla: boolean | null;
  minutos_excedidos: number | null;
  rooms?: {
    room_number: string;
    room_type_config?: { room_type: string } | null;
    zonas?: { nombre: string } | null;
  } | null;
}

interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  created_at: string;
}

interface PasswordMsg {
  type: 'ok' | 'error';
  text: string;
}

type Section = 'principal' | 'desempeno' | 'notificaciones' | 'seguridad';

export default function PerfilPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('principal');

  // Desempeño y Métricas
  const [desempenoLoading, setDesempenoLoading] = useState(false);
  const [historial, setHistorial] = useState<CicloLimpieza[]>([]);

  // Notificaciones del Turno
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  // Seguridad
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<PasswordMsg | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchProfileData = async () => {
      // 1. Obtener usuario de la sesión de Supabase Auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setLoading(false);
        return;
      }

      setLastSignIn(user.last_sign_in_at || null);

      // 2. Consultar la tabla profiles unida con la tabla hotels
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nombre,
          email,
          role,
          hotel_id,
          hotels ( name )
        `)
        .eq('id', user.id)
        .single();

      if (!error && data) {
        // Adaptar estructura relacional de Supabase
        const hotelData = Array.isArray(data.hotels) ? data.hotels[0] : data.hotels;
        setProfile({
          ...data,
          hotels: hotelData,
        });
      }

      setLoading(false);
    };

    fetchProfileData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // ---- Desempeño y Métricas (datos reales del turno actual) ----
  const cargarDesempeno = async () => {
    if (!profile) return;

    setDesempenoLoading(true);

    const inicioHoy = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const { data, error } = await supabase
      .from('ciclos_limpieza')
      .select(`
        id,
        habitacion_id,
        usuario_id,
        personal_nombre,
        estado_origen,
        sucia_at,
        iniciado_at,
        finalizado_at,
        duracion_min,
        sla_min,
        cumplio_sla,
        minutos_excedidos,
        rooms (
          room_number,
          room_type_config ( room_type ),
          zonas ( nombre )
        )
      `)
      .eq('usuario_id', profile.id)
      .not('finalizado_at', 'is', null)
      .gte('finalizado_at', inicioHoy)
      .order('finalizado_at', { ascending: false });

    if (error) {
      console.error('Error al cargar desempeño:', error.message);
    }

    if (data) {
      setHistorial(data as unknown as CicloLimpieza[]);
    }

    setDesempenoLoading(false);
  };

  // ---- Avisos del Turno (habitaciones que pasaron a Sucia hoy, leído del historial) ----
  const cargarNotificaciones = async () => {
    setNotifsLoading(true);

    const inicioHoy = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const { data, error } = await supabase
      .from('historial_estados_habitacion')
      .select(`
        id,
        fecha_cambio,
        rooms ( room_number )
      `)
      .eq('estado_nuevo', 'Sucia')
      .gte('fecha_cambio', inicioHoy)
      .order('fecha_cambio', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error al cargar avisos:', error.message);
    }

    if (data) {
      const avisos = (data as unknown as { id: string; fecha_cambio: string; rooms?: { room_number: string } | { room_number: string }[] }[])
        .map((h) => {
          const room = Array.isArray(h.rooms) ? h.rooms[0] : h.rooms;
          const numero = room?.room_number || '?';
          return {
            id: h.id,
            titulo: `Habitación ${numero} sucia`,
            mensaje: `La habitación ${numero} necesita limpieza`,
            tipo: 'sucia',
            leida: false,
            created_at: h.fecha_cambio,
          } as Notificacion;
        });
      setNotificaciones(avisos);
    }

    setNotifsLoading(false);
  };

  const marcarTodasLeidas = async () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  const marcarLeida = async (n: Notificacion) => {
    if (n.leida) return;
    setNotificaciones((prev) => prev.map((it) => (it.id === n.id ? { ...it, leida: true } : it)));
  };

  // ---- Seguridad: cambio de contraseña via Supabase Auth ----
  const handleChangePassword = async () => {
    setPasswordMsg(null);

    if (!nuevoPassword) {
      setPasswordMsg({ type: 'error', text: 'Escribe la nueva contraseña.' });
      return;
    }

    if (nuevoPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    if (nuevoPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }

    setCambiandoPassword(true);
    const { error } = await supabase.auth.updateUser({ password: nuevoPassword });
    setCambiandoPassword(false);

    if (error) {
      setPasswordMsg({ type: 'error', text: error.message });
      return;
    }

    setPasswordMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
    setNuevoPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Cargando perfil...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 space-y-4">
        <p>No se encontraron datos de perfil activos.</p>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold"
        >
          Ir a Iniciar Sesión
        </button>
      </div>
    );
  }

  // Inicial del nombre para el avatar
  const initial = profile.nombre ? profile.nombre.charAt(0).toUpperCase() : 'C';

  // ---- Cálculos de desempeño ----
  const limpiezasHoy = historial.length;
  const conDuracion = historial.filter((h) => typeof h.duracion_min === 'number');
  const promedioMin = conDuracion.length
    ? Math.round((conDuracion.reduce((acc, h) => acc + (h.duracion_min || 0), 0) / conDuracion.length) * 10) / 10
    : 0;
  const slaCumplidas = historial.filter((h) => h.cumplio_sla === true).length;
  const slaPct = limpiezasHoy ? Math.round((slaCumplidas / limpiezasHoy) * 100) : 0;

  const getRoomInfo = (h: CicloLimpieza) => ({
    room_number: h.rooms?.room_number || '',
    room_type: h.rooms?.room_type_config?.room_type || 'Estándar',
  });

  const abrirDesempeno = () => {
    setSection('desempeno');
    if (historial.length === 0) cargarDesempeno();
  };

  const abrirNotificaciones = () => {
    setSection('notificaciones');
    if (notificaciones.length === 0) cargarNotificaciones();
  };

  const getNotifIcon = (tipo: string) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('sucia') || t.includes('sla') || t.includes('límite') || t.includes('limite') || t.includes('tarde')) {
      return <TriangleAlert className="w-5 h-5 text-rose-500" />;
    }
    if (t.includes('check') || t.includes('lista') || t.includes('complet')) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    }
    return <Info className="w-5 h-5 text-indigo-500" />;
  };

  const formatFecha = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const fechaTurno = new Date().toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <main className="p-4 space-y-4">
      {section === 'principal' ? (
        <>
          {/* TARJETA PRINCIPAL DEL PERFIL */}
          <div className="bg-white dark:bg-[#131927] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-black border-4 border-slate-100 dark:border-slate-800 mx-auto mb-3 shadow-lg shadow-indigo-600/20">
              {initial}
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              {profile.nombre || 'Personal de Limpieza'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{profile.email}</p>

            <div className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold">
              <Hotel className="w-3.5 h-3.5" />
              <span>{profile.hotels?.name || 'Hotel Asignado'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="bg-slate-50 dark:bg-[#090D16] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Rol</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  {profile.role || 'Personal de Limpieza'}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#090D16] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Estado</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                  <UserCheck className="w-3 h-3" /> Activo
                </span>
              </div>
            </div>
          </div>

          {/* OPCIONES DE CONFIGURACIÓN Y SERVICIOS */}
          <div className="bg-white dark:bg-[#131927] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <button
              onClick={abrirDesempeno}
              className="w-full p-4 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Award className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold">Desempeño y Métricas</span>
              </div>
              <span className="text-slate-400 font-semibold">&gt;</span>
            </button>
            <button
              onClick={abrirNotificaciones}
              className="w-full p-4 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold">Notificaciones del Turno</span>
              </div>
              <span className="text-slate-400 font-semibold">&gt;</span>
            </button>
            <button
              onClick={() => setSection('seguridad')}
              className="w-full p-4 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold">Seguridad</span>
              </div>
              <span className="text-slate-400 font-semibold">&gt;</span>
            </button>
          </div>

          {/* BOTÓN CERRAR SESIÓN */}
          <button
            onClick={handleLogout}
            className="w-full py-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold rounded-xl flex items-center justify-center gap-2 text-xs hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </>
      ) : (
        <>
          {/* ENCABEZADO DE SECCIÓN INTERNA */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSection('principal')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors p-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <span className="text-[10px] text-slate-400 capitalize">{fechaTurno}</span>
          </div>

          {/* ================= DESEMPEÑO Y MÉTRICAS ================= */}
          {section === 'desempeno' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600" />
                  Desempeño del Turno
                </h3>
                <button
                  onClick={cargarDesempeno}
                  className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${desempenoLoading ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>

              {desempenoLoading && historial.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Cargando métricas...</div>
              ) : (
                <>
                  {/* Tarjetas de métricas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white dark:bg-[#131927] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                      <span className="text-lg font-black text-slate-900 dark:text-white block">
                        {limpiezasHoy}
                      </span>
                      <span className="text-[10px] text-slate-500">Habitaciones Limpiadas</span>
                    </div>
                    <div className="bg-white dark:bg-[#131927] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                      <Clock className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                      <span className="text-lg font-black text-slate-900 dark:text-white block">
                        {limpiezasHoy ? `${promedioMin} min` : '--'}
                      </span>
                      <span className="text-[10px] text-slate-500">Tiempo Promedio</span>
                    </div>
                    <div className="bg-white dark:bg-[#131927] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center col-span-2">
                      <Target className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block">
                        {limpiezasHoy ? `${slaPct}%` : '--'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Cumplimiento de Tiempo Límite ({slaCumplidas}/{limpiezasHoy})
                      </span>
                      {limpiezasHoy > 0 && (
                        <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${slaPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Historial del turno */}
                  <div className="bg-white dark:bg-[#131927] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    <div className="p-3.5 font-bold text-slate-900 dark:text-white">
                      Habitaciones de Hoy
                    </div>
                    {historial.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        Aún no hay limpiezas registradas en este turno.
                      </div>
                    ) : (
                      historial.map((h) => {
                        const room = getRoomInfo(h);
                        const ok = h.cumplio_sla === true;
                        return (
                          <div key={h.id} className="p-3.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                  ok
                                    ? 'bg-emerald-100 dark:bg-emerald-500/10'
                                    : 'bg-rose-100 dark:bg-rose-500/10'
                                }`}
                              >
                                {ok ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <TriangleAlert className="w-4 h-4 text-rose-500" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  Hab. {room?.room_number || 'N/A'}
                                </span>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {room?.room_type || 'Estándar'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  ok
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                }`}
                              >
                                {h.duracion_min != null ? `${h.duracion_min} min` : '--'}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatFecha(h.finalizado_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================= NOTIFICACIONES DEL TURNO ================= */}
          {section === 'notificaciones' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  Avisos del Turno
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cargarNotificaciones}
                    className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    <RefreshCw className={`w-3 h-3 ${notifsLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </button>
                  <button
                    onClick={marcarTodasLeidas}
                    className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold hover:underline"
                  >
                    Marcar todas leídas
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#131927] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {notifsLoading && notificaciones.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">Cargando notificaciones...</div>
                ) : notificaciones.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                    <Inbox className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                    No hay avisos registrados en este turno.
                  </div>
                ) : (
                  notificaciones.map((n) => (
                    <div key={n.id} className="p-3.5 flex items-start gap-3">
                      <div className="shrink-0">{getNotifIcon(n.tipo)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {n.titulo}
                          </span>
                          {!n.leida && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          {n.mensaje}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatFecha(n.created_at)}</p>
                      </div>
                      {!n.leida && (
                        <button
                          onClick={() => marcarLeida(n)}
                          className="text-slate-300 dark:text-slate-600 hover:text-indigo-500 transition-colors p-0.5 shrink-0"
                          title="Marcar como leída"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================= SEGURIDAD ================= */}
          {section === 'seguridad' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  Seguridad de la Cuenta
                </h3>
              </div>

              {/* Información de sesión */}
              <div className="bg-white dark:bg-[#131927] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {profile.email}
                    </p>
                    <p className="text-[10px] text-slate-500">Sesión de Supabase Auth</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <UserCheck className="w-3 h-3" /> Activa
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Último inicio de sesión</span>
                  <span className="font-semibold capitalize text-slate-900 dark:text-white">
                    {lastSignIn
                      ? new Date(lastSignIn).toLocaleString('es', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--'}
                  </span>
                </div>
              </div>

              {/* Cambio de contraseña */}
              <div className="bg-white dark:bg-[#131927] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 text-xs space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-500" />
                  Cambiar Contraseña
                </h4>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={nuevoPassword}
                      onChange={(e) => setNuevoPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 pr-9 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Confirmar contraseña</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="w-full bg-slate-50 dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                </div>

                {passwordMsg && (
                  <div
                    className={`text-[11px] font-semibold rounded-lg px-3 py-2 ${
                      passwordMsg.type === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                    }`}
                  >
                    {passwordMsg.text}
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={cambiandoPassword}
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-500 transition-colors disabled:opacity-60"
                >
                  {cambiandoPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    'Guardar Nueva Contraseña'
                  )}
                </button>
              </div>

              {/* Cerrar sesión */}
              <button
                onClick={handleLogout}
                className="w-full py-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold rounded-xl flex items-center justify-center gap-2 text-xs hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión en este Dispositivo
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}