'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Sliders, 
  DoorClosed, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  Search, 
  Plus, 
  Edit3, 
  RefreshCw,
  Building,
  LogOut,
  X,
  Power,
  Menu
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TipoPromedioChart, PersonalChart, SlaBreachChart, BAR_COLORS } from './charts';
import TiemposConfig from './tiempos-config';



// Límite de habitaciones por lote para evitar creación masiva accidental
const MAX_ROOMS_PER_BATCH = 200;

// Construye la lista de números de habitación a partir de un rango (ej. 102 -> 107)
const buildRoomRange = (fromRaw: string, toRaw: string): string[] => {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from) return [];
  if (!to || to === from) return [from];

  // Soporta prefijos (ej. "H101" -> "H105") preservando el ancho numérico
  const mFrom = from.match(/^(.*?)(\d+)$/);
  const mTo = to.match(/^(.*?)(\d+)$/);

  if (mFrom && mTo && mFrom[1] === mTo[1]) {
    const prefix = mFrom[1];
    const width = mFrom[2].length;
    const start = parseInt(mFrom[2], 10);
    const end = parseInt(mTo[2], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      const result: string[] = [];
      for (let i = start; i <= end; i++) {
        result.push(prefix + String(i).padStart(width, '0'));
      }
      return result;
    }
  }

  // Fallback: rango numérico simple
  const start = parseInt(from, 10);
  const end = parseInt(to, 10);
  if (!isNaN(start) && !isNaN(end) && end >= start) {
    const result: string[] = [];
    for (let i = start; i <= end; i++) result.push(String(i));
    return result;
  }

  return [from];
};

// Límite de pisos por rango para evitar creación masiva accidental
const MAX_ZONAS_PER_BATCH = 50;

// Extrae el número de un nombre de piso (ej. "Piso 3" -> 3, "1" -> 1). null si es un nombre libre.
const numericFloorOf = (nombre: string): number | null => {
  const m = nombre.trim().match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
};

// Calcula el siguiente número de piso esperado: la secuencia numérica debe ser
// contigua desde 1. Si existen "Piso 1".."Piso 5", devuelve 6 (no se permiten saltos).
const computeNextNumericFloor = (zonas: ZonaData[]): number => {
  const numeros = new Set(
    zonas
      .map((z) => numericFloorOf(z.nombre || ''))
      .filter((n): n is number => n !== null)
  );
  let n = 1;
  while (numeros.has(n)) n++;
  return n;
};

interface UsuarioData {
  id: string;
  nombre?: string | null;
  email?: string | null;
  role?: string | null;
  activo?: boolean | null;
}

interface RoomTypeConfig {
  id: string;
  room_type: string;
  tiempo_estandar_min: number;
  sla_min: number;
}

interface HabitacionData {
  id: string;
  room_number?: string | null;
  tipo_habitacion_id?: string | null;
  room_type_config?: RoomTypeConfig | null;
  zona_id?: string | null;
  zonas?: { nombre: string } | null;
  status?: string | null;
}

interface ZonaData {
  id: string;
  nombre?: string | null;
}

// Filas de las tablas de métricas precomputadas (mantenidas por trigger)
interface MetricResumen {
  total_limpiezas: number;
  suma_duracion_min: number;
  sla_cumplidas: number;
  sla_retrasadas: number;
}

interface MetricDetalle {
  dimension: 'tipo' | 'zona' | 'personal';
  clave: string;
  nombre?: string | null;
  limpiezas: number;
  suma_duracion_min: number;
  cumplidas: number;
  suma_exceso_min?: number;
}

interface AnalyticsData {
  porTipo: { tipo: string; promedio: number; limpiezas: number; cumplidas: number; slaPct: number }[];
  porZona: { zona: string; promedio: number; limpiezas: number; cumplidas: number; slaPct: number }[];
  porPersonal: { id: string; nombre: string; promedio: number; limpiezas: number; cumplidas: number; slaPct: number; excesoMin: number }[];
  porPersonalSlaBreach: { id: string; nombre: string; excesoMin: number; limpiezas: number; retrasadas: number }[];
  totalLimpiezas: number;
}

interface KpisData {
  tiempoPromedio: string;
  habitacionesLimpias: string;
  alertasSla: string;
  personalActivo: string;
}

// Deriva KPIs y gráficos desde las tablas resumen O(1) del trigger
function buildMetrics(
  metric: MetricResumen | null,
  detalle: MetricDetalle[],
  roomsRows: { status?: string | null }[],
  usersRows: { activo?: boolean | null }[]
): { kpis: KpisData; analytics: AnalyticsData } {
  const totalLimpiezas = metric?.total_limpiezas ?? 0;
  const slaCumplidas = metric?.sla_cumplidas ?? 0;
  const slaRetrasadas = metric?.sla_retrasadas ?? 0;
  const tiempoPromedio =
    totalLimpiezas > 0 && metric ? `${Math.round(metric.suma_duracion_min / totalLimpiezas)} min` : '--';

  const toRow = (d: MetricDetalle) => ({
    promedio: d.limpiezas ? Math.round(d.suma_duracion_min / d.limpiezas) : 0,
    limpiezas: d.limpiezas,
    cumplidas: d.cumplidas,
    slaPct: d.limpiezas ? Math.round((d.cumplidas / d.limpiezas) * 100) : 0,
    excesoMin: d.suma_exceso_min ?? 0,
  });

  const porTipo = detalle
    .filter((d) => d.dimension === 'tipo')
    .map((d) => ({ tipo: d.clave, ...toRow(d) }))
    .sort((a, b) => b.limpiezas - a.limpiezas);

  const porZona = detalle
    .filter((d) => d.dimension === 'zona')
    .map((d) => ({ zona: d.clave, ...toRow(d) }))
    .sort((a, b) => b.limpiezas - a.limpiezas);

  const porPersonal = detalle
    .filter((d) => d.dimension === 'personal')
    .map((d) => ({ id: d.clave, nombre: d.nombre || 'Personal', ...toRow(d) }))
    .sort((a, b) => b.limpiezas - a.limpiezas) as { id: string; nombre: string; promedio: number; limpiezas: number; cumplidas: number; slaPct: number; excesoMin: number }[];

  // DEBUG
  console.log('DEBUG: porPersonal after buildMetrics:', porPersonal);
  console.log('DEBUG: porPersonalSlaBreach:', porPersonal.map(p => ({ nombre: p.nombre, excesoMin: p.excesoMin })));

  const porPersonalSlaBreach = porPersonal
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      excesoMin: p.excesoMin,
      limpiezas: p.limpiezas,
      retrasadas: p.limpiezas - p.cumplidas,
    }))
    .sort((a, b) => b.excesoMin - a.excesoMin);

  const analytics: AnalyticsData = {
      porTipo,
      porZona,
      porPersonal,
      porPersonalSlaBreach,
      totalLimpiezas,
    };

  return {
    kpis: {
      tiempoPromedio,
      // Una habitación cuenta como "limpia" si NO está sucia (ni en limpieza).
      // Así las habitaciones Disponibles/Ocupadas/Limpias cuentan como limpias.
      habitacionesLimpias: `${roomsRows.filter((h) => {
        const s = (h.status || '').toLowerCase();
        return s !== 'sucia' && s !== 'en limpieza';
      }).length} / ${roomsRows.length}`,
      alertasSla: `${slaRetrasadas} / ${slaCumplidas}`,
      personalActivo: `${usersRows.filter((u) => u.activo !== false).length} Agentes`,
    },
    analytics,
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  // Sección activa controlada por el menú lateral. Se inicializa de forma perezosa desde la URL
  // (?seccion=) para que el ítem iluminado del sidebar siempre coincida con la vista (sin efecto,
  // lo que evita rends en cascada y pasa react-hooks/set-state-in-effect).
  const [activeSection, setActiveSection] = useState<'dashboard' | 'parametrica' | 'usuarios'>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const s = new URLSearchParams(window.location.search).get('seccion');
    return s === 'parametrica' || s === 'usuarios' ? s : 'dashboard';
  });
  // Pestaña interna de la sección paramétrica / usuarios, inicializada también desde la URL (?tab=).
  const [activeTab, setActiveTab] = useState<'zonas' | 'habitaciones' | 'tiempos' | 'usuarios'>(() => {
    if (typeof window === 'undefined') return 'habitaciones';
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'zonas' || t === 'habitaciones' || t === 'tiempos' || t === 'usuarios' ? t : 'habitaciones';
  });

  // Navegación atómica: actualiza estado + URL (?seccion= y ?tab=) a la vez. Los botones del
  // sidebar y las pestañas leen estos estados para que el resaltado siga siempre a la vista.
  const navigate = useCallback((section: 'dashboard' | 'parametrica' | 'usuarios', tab: 'zonas' | 'habitaciones' | 'tiempos' | 'usuarios') => {
    setActiveSection(section);
    setActiveTab(tab);
    router.replace(`?seccion=${section}&tab=${tab}`, { scroll: false });
  }, [router]);

  // Responsive sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Solo lectura inicial del lado del cliente (evita usar useSearchParams y su Suspense en build estático)
    const params = new URLSearchParams(window.location.search);
    const seccion = params.get('seccion');
    const tab = params.get('tab');
    if (seccion === 'parametrica' || seccion === 'usuarios') {
      setActiveSection(seccion);
    }
    if (tab === 'zonas' || tab === 'habitaciones' || tab === 'tiempos' || tab === 'usuarios') {
      setActiveTab(tab);
    }
    // Close sidebar on mobile when navigating
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Estados de datos de Supabase
  const [usuarios, setUsuarios] = useState<UsuarioData[]>([]);
  const [habitaciones, setHabitaciones] = useState<HabitacionData[]>([]);
  const [zonas, setZonas] = useState<ZonaData[]>([]);
  
  // Estados para modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'zona' | 'editarZona' | 'habitacion' | 'usuario' | 'editarUsuario'>('habitacion');
  const [submitting, setSubmitting] = useState(false);

  // Campos de formularios
  const [nombreZona, setNombreZona] = useState('');
  const [zonaMode, setZonaMode] = useState<'rango' | 'personalizado'>('rango');
  const [zonaDesde, setZonaDesde] = useState('');
  const [zonaHasta, setZonaHasta] = useState('');
  const [zonaError, setZonaError] = useState('');
  const [zonaEditId, setZonaEditId] = useState<string | null>(null);
  const [zonaEditName, setZonaEditName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomNumberEnd, setRoomNumberEnd] = useState('');
  const [selectedZonaId, setSelectedZonaId] = useState('');
  const [roomType, setRoomType] = useState<string>('');
  
  // Formulario de Usuario
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('recepcionista');
  const [userPassword, setUserPassword] = useState('');

  const [kpis, setKpis] = useState({
    tiempoPromedio: '--',
    habitacionesLimpias: '0 / 0',
    alertasSla: '0',
    personalActivo: '0'
  });
  const [hotelInfo, setHotelInfo] = useState<{ name?: string } | null>(null);
  const [adminProfile, setAdminProfile] = useState<{ nombre?: string; role?: string } | null>(null);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomTypeConfig[]>([]);

  // Desglose analítico de limpiezas (métricas de tiempos por tipo, zona y personal de limpieza)
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    porTipo: [],
    porZona: [],
    porPersonal: [],
    porPersonalSlaBreach: [],
    totalLimpiezas: 0,
  });

  const fetchAdminData = async () => {
    // 1. Usuario autenticado y su perfil (para el sidebar y el hotel)
    const { data: { user } } = await supabase.auth.getUser();
    setLoading(true);
    let adminHotelId: string | null = null;

    if (user) {
      const { data: adminData } = await supabase
        .from('profiles')
        .select('nombre, role, hotel_id')
        .eq('id', user.id)
        .single();
      if (adminData) {
        setAdminProfile({ nombre: adminData.nombre, role: adminData.role });
        adminHotelId = adminData.hotel_id;
      }
    }

    // 2. Nombre real del hotel
    if (adminHotelId) {
      const { data: hotelData } = await supabase
        .from('hotels')
        .select('name')
        .eq('id', adminHotelId)
        .single();
      if (hotelData) setHotelInfo({ name: hotelData.name });
    }

    // 3. Datos operativos filtrados por el hotel del administrador
    let userQuery = supabase.from('profiles').select('*');
    let habQuery = supabase
      .from('rooms')
      .select(`
        *,
        room_type_config:tipo_habitacion_id ( id, room_type, tiempo_estandar_min, sla_min ),
        zonas:zona_id ( nombre )
      `);
    let zonaQuery = supabase.from('zonas').select('*');
    let metQuery = supabase
      .from('metricas_limpieza')
      .select('total_limpiezas, suma_duracion_min, sla_cumplidas, sla_retrasadas');
    let detQuery = supabase
      .from('metricas_limpieza_detalle')
      .select('dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, suma_exceso_min');

    if (adminHotelId) {
      setHotelId(adminHotelId);
      userQuery = userQuery.eq('hotel_id', adminHotelId);
      habQuery = habQuery.eq('hotel_id', adminHotelId);
      zonaQuery = zonaQuery.eq('hotel_id', adminHotelId);
      metQuery = metQuery.eq('hotel_id', adminHotelId);
      detQuery = detQuery.eq('hotel_id', adminHotelId);

      // Fetch room types for this hotel (with UUID ids for the modal select)
      const { data: roomTypeData } = await supabase
        .from('room_type_config')
        .select('id, room_type, tiempo_estandar_min, sla_min')
        .eq('hotel_id', adminHotelId)
        .order('room_type', { ascending: true });
      if (roomTypeData) {
        setRoomTypes(roomTypeData);
      }
    }

    const { data: userData } = await userQuery;
    const { data: habData } = await habQuery;
    const { data: zonaData } = await zonaQuery;
    const { data: metData } = await metQuery.maybeSingle();
    const { data: detData } = await detQuery;

    if (userData) setUsuarios(userData);
    if (habData) setHabitaciones(habData);
    if (zonaData) setZonas(zonaData);

    // 4. Métricas precomputadas (tablas mantenidas por trigger) + KPIs
    const result = buildMetrics(
      (metData as MetricResumen | null) ?? null,
      (detData as MetricDetalle[]) || [],
      (habData || []) as { status?: string | null }[],
      (userData || []) as { activo?: boolean | null }[]
    );
    setAnalytics(result.analytics);
    setKpis(result.kpis);

    setLoading(false);
  };

  useEffect(() => {
    setTimeout(() => {
      fetchAdminData();
    }, 0);
  }, []);

  // Actualiza KPIs y gráficos desde las tablas resumen O(1) del trigger
  const refreshLiveMetrics = useCallback(async () => {
    if (!hotelId) return;

    const { data: metData } = await supabase
      .from('metricas_limpieza')
      .select('total_limpiezas, suma_duracion_min, sla_cumplidas, sla_retrasadas')
      .eq('hotel_id', hotelId)
      .maybeSingle();
    const { data: detData } = await supabase
      .from('metricas_limpieza_detalle')
      .select('dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, suma_exceso_min')
      .eq('hotel_id', hotelId);

    // DEBUG: Log the raw data
    console.log('DEBUG: metricas_limpieza_detalle raw data:', detData);
    console.log('DEBUG: personal dimension data:', detData?.filter(d => d.dimension === 'personal'));
    console.log('DEBUG: suma_exceso_min values:', detData?.filter(d => d.dimension === 'personal').map(d => ({ clave: d.clave, nombre: d.nombre, suma_exceso_min: d.suma_exceso_min })));
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('status')
      .eq('hotel_id', hotelId);
    const { data: usersData } = await supabase
      .from('profiles')
      .select('activo')
      .eq('hotel_id', hotelId);

    const result = buildMetrics(
      (metData as MetricResumen | null) ?? null,
      (detData as MetricDetalle[]) || [],
      (roomsData || []) as { status?: string | null }[],
      (usersData || []) as { activo?: boolean | null }[]
    );
    setKpis(result.kpis);
    setAnalytics(result.analytics);
  }, [hotelId]);

  // Suscripción en tiempo real sobre las tablas resumen y los estados de habitación
  useEffect(() => {
    if (!hotelId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = (payload: any) => {
      console.log('[Admin Realtime] Event received:', payload.eventType, payload.table, payload);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshLiveMetrics();
      }, 500);
    };

    const channel = supabase
      .channel(`admin-live-${hotelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'metricas_limpieza', filter: `hotel_id=eq.${hotelId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'metricas_limpieza_detalle', filter: `hotel_id=eq.${hotelId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `hotel_id=eq.${hotelId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ciclos_limpieza', filter: `hotel_id=eq.${hotelId}` },
        scheduleRefresh
      )
      .subscribe((status, err) => {
        console.log('[Admin Realtime] Subscription status:', status, err);
      });

    return () => {
      supabase.removeChannel(channel);
      if (timer) clearTimeout(timer);
    };
  }, [hotelId, refreshLiveMetrics]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // --- FUNCIÓN PARA CAMBIAR ESTADO (ACTIVAR / DESACTIVAR) ---
  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const nuevoEstado = currentStatus === false ? true : false;
    const { error } = await supabase
      .from('profiles')
      .update({ activo: nuevoEstado })
      .eq('id', userId);

    if (error) {
      alert('Error al cambiar estado del usuario: ' + error.message);
    } else {
      fetchAdminData();
    }
  };

  // --- MODIFICAR USUARIO ---
  const handleUpdateUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !userName.trim()) return;

    const nuevaPassword = userPassword.trim();
    if (nuevaPassword && nuevaPassword.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: userName,
          role: userRole
        })
        .eq('id', selectedUserId);

      if (error) {
        alert('Error al actualizar usuario: ' + error.message);
        setSubmitting(false);
        return;
      }

      // Cambio de contraseña (intenta Edge Function y si no está desplegada usa RPC Postgres)
      if (nuevaPassword) {
        let passwordActualizada = false;
        let mensajeError = '';

        // 1. Intentar mediante la Edge Function 'cambiar-password'
        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke('bright-worker', {
            body: { userId: selectedUserId, newPassword: nuevaPassword }
          });

          if (!fnError && fnData && !fnData.error) {
            passwordActualizada = true;
          } else {
            mensajeError = fnError?.message || fnData?.error || '';
          }
        } catch (e) {
          mensajeError = e instanceof Error ? e.message : String(e);
        }

        // 2. Si la Edge Function falló o no está desplegada, intentar vía función SQL RPC
        if (!passwordActualizada) {
          try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('admin_cambiar_password', {
              p_user_id: selectedUserId,
              p_new_password: nuevaPassword
            });

            if (!rpcError && (!rpcData || rpcData.success !== false)) {
              passwordActualizada = true;
            } else if (rpcError || (rpcData && rpcData.error)) {
              mensajeError = rpcError?.message || rpcData?.error || mensajeError;
            }
          } catch {
            // mantener mensaje de error previo
          }
        }

        if (!passwordActualizada) {
          alert(
            'El perfil se actualizó, pero no se pudo cambiar la contraseña:\n' +
            mensajeError +
            '\n\nPara resolverlo, despliega la Edge Function "cambiar-password" o ejecuta la migración SQL "20260919_admin_cambiar_password.sql" en el SQL Editor de Supabase.'
          );
          setSubmitting(false);
          return;
        }
      }

      alert(nuevaPassword ? 'Usuario y contraseña actualizados correctamente.' : 'Usuario modificado correctamente.');
      setIsModalOpen(false);
      setSelectedUserId(null);
      setUserName('');
      setUserEmail('');
      setUserRole('recepcionista');
      setUserPassword('');
      fetchAdminData();
    } catch (err) {
      alert('Ocurrió un error: ' + (err instanceof Error ? err.message : String(err)));
    }
    setSubmitting(false);
  };

  // --- CREACIONES ---
  const handleCreateZona = async (e: React.FormEvent) => {
    e.preventDefault();
    setZonaError('');
    setSubmitting(true);

    const existentesLower = zonas.map((z) => (z.nombre || '').trim().toLowerCase());
    const numerosExistentes = new Set(
      zonas
        .map((z) => numericFloorOf(z.nombre || ''))
        .filter((n): n is number => n !== null)
    );
    const siguiente = computeNextNumericFloor(zonas);

    let nombresNuevos: string[] = [];
    let modo = '';
    let errorMsg = '';

    if (zonaMode === 'rango') {
      // ---- MODO RANGO NUMÉRICO ----
      const desde = Math.floor(Number(zonaDesde));
      const hasta = Math.floor(Number(zonaHasta));

      if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde) {
        errorMsg = 'Ingresa un rango numérico válido (Desde y Hasta, ambos ≥ 1 y Hasta ≥ Desde).';
      } else if (hasta - desde + 1 > MAX_ZONAS_PER_BATCH) {
        errorMsg = `El rango genera ${hasta - desde + 1} pisos. El máximo permitido por lote es ${MAX_ZONAS_PER_BATCH}.`;
      } else if (desde !== siguiente) {
        errorMsg = numerosExistentes.size > 0
          ? `Los pisos numéricos deben ser secuenciales y no pueden saltarse números. Ya existen del 1 al ${siguiente - 1}; el siguiente rango debe comenzar estrictamente en ${siguiente}.`
          : `Los pisos numéricos deben comenzar en 1. El siguiente número disponible es ${siguiente}.`;
      } else {
        modo = 'Rango numérico';
        nombresNuevos = Array.from({ length: hasta - desde + 1 }, (_, i) => `Piso ${desde + i}`);
      }
    } else {
      // ---- MODO PERSONALIZADO / ESPECIAL ----
      const nombre = nombreZona.trim();
      if (!nombre) {
        errorMsg = 'Escribe el nombre del piso o zona especial.';
      } else {
        const numero = numericFloorOf(nombre);
        const yaExiste = existentesLower.includes(nombre.toLowerCase());
        const duplicadoNumerico = numero !== null && numerosExistentes.has(numero);

        if (yaExiste || duplicadoNumerico) {
          errorMsg = `Ya existe un piso llamado "${nombre}". Usa otro nombre para evitar duplicados.`;
        } else if (numero !== null && numero > siguiente) {
          errorMsg = `Los pisos numéricos deben ser secuenciales. El siguiente número disponible es ${siguiente}.`;
        } else {
          modo = 'Personalizado';
          nombresNuevos = [nombre];
        }
      }
    }

    if (errorMsg) {
      setZonaError(errorMsg);
      setSubmitting(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSubmitting(false); return; }

      const { data: profileData } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single();
      if (!profileData?.hotel_id) { setSubmitting(false); return; }

      const rows = nombresNuevos.map((nombre) => ({ nombre, hotel_id: profileData.hotel_id! }));
      const { error } = await supabase.from('zonas').insert(rows);

      if (error) {
        alert('Error: ' + error.message);
      } else if (modo === 'Rango numérico') {
        alert(
          `Pisos creados en secuencia: ${nombresNuevos.join(', ')} (${nombresNuevos.length} pisos en total).`
        );
        setNombreZona('');
        setZonaDesde('');
        setZonaHasta('');
        setZonaMode('rango');
        setIsModalOpen(false);
        fetchAdminData();
      } else {
        alert(`Piso creado correctamente: ${nombresNuevos.join(', ')}`);
        setNombreZona('');
        setZonaDesde('');
        setZonaHasta('');
        setZonaMode('rango');
        setIsModalOpen(false);
        fetchAdminData();
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    }
    setSubmitting(false);
  };

  // --- EDICIÓN DE ZONA / PISO (solo nombre, sin eliminar por integridad histórica) ---
  const handleUpdateZona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zonaEditId || !zonaEditName.trim()) return;

    const duplicado = zonas.some(
      (z) => z.id !== zonaEditId && (z.nombre || '').trim().toLowerCase() === zonaEditName.trim().toLowerCase()
    );
    if (duplicado) {
      alert('Ya existe otro piso con ese nombre.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('zonas')
        .update({ nombre: zonaEditName.trim() })
        .eq('id', zonaEditId);

      if (error) {
        alert('Error: ' + error.message);
      } else {
        alert('Piso actualizado correctamente.');
        setZonaEditId(null);
        setZonaEditName('');
        setIsModalOpen(false);
        fetchAdminData();
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    }
    setSubmitting(false);
  };

  const handleCreateHabitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !selectedZonaId) return;

    // Generar el lote de números a partir del rango indicado
    const numeros = buildRoomRange(roomNumber, roomNumberEnd);

    if (numeros.length === 0) {
      alert('Ingresa al menos un número de habitación válido.');
      return;
    }

    if (numeros.length > MAX_ROOMS_PER_BATCH) {
      alert(`El rango genera ${numeros.length} habitaciones. El máximo permitido por lote es ${MAX_ROOMS_PER_BATCH}.`);
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSubmitting(false); return; }

      const { data: profileData } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single();
      if (!profileData?.hotel_id) { setSubmitting(false); return; }

      const zonaSeleccionada = zonas.find(z => z.id === selectedZonaId);
      const zonaNombre = zonaSeleccionada ? zonaSeleccionada.nombre : '';

      // Obtener el UUID del tipo de habitación seleccionado
      const tipoSeleccionado = roomTypes.find(rt => rt.id === roomType);
      const tipoHabitacionId = tipoSeleccionado?.id;

      if (!tipoHabitacionId) {
         alert('Tipo de habitación no válido. Por favor seleccione un tipo.');
        setSubmitting(false);
        return;
      }

      // Omitir números que ya existan para evitar duplicados
      const existentes = new Set(habitaciones.map((h) => String(h.room_number)));
      const nuevos = numeros.filter(n => !existentes.has(n));
      const duplicados = numeros.filter(n => existentes.has(n));

      if (nuevos.length === 0) {
        alert('Todas las habitaciones del rango ya existen.');
        setSubmitting(false);
        return;
      }

      const rows = nuevos.map(numero => ({
        room_number: numero,
        hotel_id: profileData.hotel_id,
        zona_id: selectedZonaId,
        tipo_habitacion_id: tipoHabitacionId,
        status: 'Disponible'
      }));

      const { error } = await supabase.from('rooms').insert(rows);

      if (error) {
        alert('Error: ' + error.message);
      } else {
        const resumen = duplicados.length
          ? `${nuevos.length} habitación(es) creada(s). Se omitieron ${duplicados.length} que ya existían.`
          : `${nuevos.length} habitación(es) creada(s) como "${roomType}".`;
        alert(resumen);
        setRoomNumber('');
        setRoomNumberEnd('');
        setSelectedZonaId('');
        setIsModalOpen(false);
        fetchAdminData();
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    }
    setSubmitting(false);
  };

  const handleCreateUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single();
      if (!profileData?.hotel_id) return;

      const { error } = await supabase.auth.signUp({
        email: userEmail,
        password: '123456',
        options: {
          data: { nombre: userName, role: userRole, hotel_id: profileData.hotel_id, activo: true }
        }
      });

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        alert('Usuario creado exitosamente.');
        setUserName(''); setUserEmail(''); setUserRole('recepcionista');
        setIsModalOpen(false);
        fetchAdminData();
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    }
    setSubmitting(false);
  };

  const filteredData = () => {
    if (activeTab === 'usuarios') {
      return usuarios.filter(u => u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    } else if (activeTab === 'habitaciones') {
      return habitaciones.filter(h => h.room_number?.toLowerCase().includes(searchTerm.toLowerCase()));
    } else {
      return zonas.filter(z => z.nombre?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-200 flex font-sans transition-colors duration-300">
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-white dark:bg-[#0b0f19] border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-5 select-none shrink-0 transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider text-slate-900 dark:text-white">AppHR</h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide">HOTEL OPERATIONS</p>
            </div>
          </div>

          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-3">Operaciones</p>
          
          <nav className="space-y-1">
            <button 
              onClick={() => { setActiveSection('dashboard'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${activeSection === 'dashboard' ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Gerencial</span>
            </button>

            <button 
              onClick={() => { navigate('parametrica', 'habitaciones'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${activeSection === 'parametrica' ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <Sliders className="w-4 h-4" />
              <span>Gestión Paramétrica</span>
            </button>

            <button 
              onClick={() => { navigate('usuarios', 'usuarios'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${activeSection === 'usuarios' ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <Users className="w-4 h-4" />
              <span>Gestión de Usuarios</span>
            </button>
          </nav>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 font-medium">Tema Visual</span>
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center font-bold text-xs">
                {(adminProfile?.nombre || 'AD').substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{adminProfile?.nombre || 'Usuario'}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize">{adminProfile?.role || 'admin'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Cerrar Sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:ml-0">
        <header className="h-20 border-b border-slate-200 dark:border-slate-800/80 px-4 lg:px-8 flex items-center justify-between bg-white/50 dark:bg-[#0b0f19]/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button 
              className="lg:hidden p-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-500 transition-colors shadow-sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Panel de Administración General</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monitoreo operativo, control de personal y parámetros del hotel.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm hidden sm:flex">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{hotelInfo?.name || 'Hotel no configurado'}</span>
            </div>
            <button onClick={fetchAdminData} className="p-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-indigo-500 transition-colors shadow-sm" title="Actualizar datos">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 space-y-6">
          
          {/* VISTA 1: DASHBOARD GERENCIAL */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tiempo Promedio</span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500"><Clock className="w-4 h-4" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{kpis.tiempoPromedio}</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Promedio de limpiezas registradas</p>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Habitaciones Limpias</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="w-4 h-4" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{kpis.habitacionesLimpias}</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Actualizado en tiempo real</p>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Alertas de Tiempo Límite</span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><AlertTriangle className="w-4 h-4" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{kpis.alertasSla}</h3>
                  <p className="text-[11px] text-amber-500 font-medium mt-1">Retrasadas / Cumplidas a tiempo</p>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Personal Activo</span>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500"><UserCheck className="w-4 h-4" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{kpis.personalActivo}</h3>
                  <p className="text-[11px] text-emerald-500 font-medium mt-1">Personal registrado en el hotel</p>
                </div>
              </div>

              {/* DESGLOSE ANALÍTICO */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Promedio por tipo de habitación */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Promedio por Tipo de Habitación</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{analytics.totalLimpiezas} limpiezas registradas</p>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500"><DoorClosed className="w-4 h-4" /></div>
                  </div>

                  {analytics.porTipo.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Sin limpiezas registradas todavía.</p>
                  ) : (
                    <div>
                      <TipoPromedioChart data={analytics.porTipo} />
                      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                        {analytics.porTipo.map((t, i) => (
                          <span key={t.tipo} className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                            {t.tipo}: {t.promedio} min · A Tiempo {t.slaPct}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rendimiento por zona / piso */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rendimiento por Zona</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tiempo promedio y cumplimiento a tiempo por zona / piso</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500"><Building className="w-4 h-4" /></div>
                  </div>

                  {analytics.porZona.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Sin limpiezas registradas todavía.</p>
                  ) : (
                    <div>
                      <TipoPromedioChart
                        data={analytics.porZona.map((z) => ({
                          tipo: z.zona,
                          promedio: z.promedio,
                          limpiezas: z.limpiezas,
                          slaPct: z.slaPct,
                        }))}
                      />
                      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                        {analytics.porZona.map((z, i) => (
                          <span key={z.zona} className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                            {z.zona}: {z.promedio} min · A Tiempo {z.slaPct}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rendimiento por personal de limpieza */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rendimiento por Personal</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tiempo promedio y cumplimiento a tiempo</p>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500"><UserCheck className="w-4 h-4" /></div>
                  </div>

                  {analytics.porPersonal.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Sin limpiezas registradas todavía.</p>
                  ) : (
                    <div>
                      <PersonalChart data={analytics.porPersonal} />
                      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                        {analytics.porPersonal.map((c) => (
                          <span key={c.id} className="text-[10px] text-slate-500 flex items-center gap-1">
                            {c.nombre}: {c.promedio} min · {c.cumplidas}/{c.limpiezas} a tiempo
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Incumplimiento de Tiempo (SLA) por Personal */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Incumplimiento de Tiempo (SLA)</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Minutos totales excedidos del límite por personal</p>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500"><AlertTriangle className="w-4 h-4" /></div>
                  </div>

                  {analytics.porPersonalSlaBreach.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Sin limpiezas registradas todavía.</p>
                  ) : (
                    <div>
                      <SlaBreachChart data={analytics.porPersonalSlaBreach} />
                      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                        {analytics.porPersonalSlaBreach.map((p) => (
                          <span key={p.id} className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                            {p.nombre}: {p.excesoMin} min de retraso total
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VISTA 2: GESTIÓN PARAMÉTRICA Y DE USUARIOS */}
          {(activeSection === 'parametrica' || activeSection === 'usuarios') && (
            <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm animate-in fade-in duration-200">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#0b0f19] p-1.5 rounded-xl w-full sm:w-auto">
                  <button
                    onClick={() => { setActiveTab('zonas'); setActiveSection('parametrica'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'zonas' ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    Zonas y Pisos
                  </button>
                  <button
                    onClick={() => { setActiveTab('habitaciones'); setActiveSection('parametrica'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'habitaciones' ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    Habitaciones
                  </button>
                  <button
                    onClick={() => { setActiveTab('tiempos'); setActiveSection('parametrica'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'tiempos' ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    Tiempos / Controles
                  </button>
                  <button
                    onClick={() => { setActiveTab('usuarios'); setActiveSection('usuarios'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'usuarios' ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    Usuarios del Hotel
                  </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {activeTab !== 'tiempos' && (
                    <>
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar..."
                      className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button 
                    onClick={() => {
                      if (activeTab === 'zonas') {
                        setModalType('zona');
                        setNombreZona('');
                        setZonaDesde('');
                        setZonaHasta('');
                        setZonaMode('rango');
                        setZonaError('');
                      }
                      else if (activeTab === 'habitaciones') setModalType('habitacion');
                      else { setModalType('usuario'); setUserName(''); setUserEmail(''); setUserRole('recepcionista'); setUserPassword(''); }
                      setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    {activeTab === 'usuarios' ? 'Nuevo Usuario' : activeTab === 'habitaciones' ? 'Nueva Habitación' : 'Nueva Zona'}
                  </button>
                    </>
                  )}
                </div>
              </div>

              {/* CONFIGURACIÓN DE TIEMPOS Y CONTROLES */}
              {activeTab === 'tiempos' && <TiemposConfig />}

              {/* TABLA DE USUARIOS */}
              {activeTab === 'usuarios' && (
                <div className="overflow-x-auto pt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 px-4">Nombre y Apellido</th>
                        <th className="pb-3 px-4">Correo Electrónico</th>
                        <th className="pb-3 px-4">Rol Asignado</th>
                        <th className="pb-3 px-4">Estado</th>
                        <th className="pb-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                      {loading ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500">Cargando personal registrado...</td></tr>
                      ) : filteredData().length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500">No hay usuarios registrados.</td></tr>
                      ) : (
                        (filteredData() as UsuarioData[]).map((usr) => {
                          const isActivo = usr.activo !== false;
                          return (
                            <tr key={usr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-indigo-600/10 text-indigo-500 flex items-center justify-center font-bold text-[10px]">
                                  {usr.nombre ? usr.nombre.substring(0, 2).toUpperCase() : 'US'}
                                </div>
                                {usr.nombre || 'Usuario sin nombre'}
                              </td>
                              <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{usr.email || 'N/D'}</td>
                              <td className="py-4 px-4">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  usr.role === 'admin' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                }`}>
                                  {usr.role || 'limpieza'}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  isActivo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isActivo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  {isActivo ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right space-x-2">
                                <button 
                                  onClick={() => {
                                    setSelectedUserId(usr.id);
                                    setUserName(usr.nombre || '');
                                    setUserRole(usr.role || 'recepcionista');
                                    setUserPassword('');
                                    setModalType('editarUsuario');
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors font-medium inline-flex items-center gap-1"
                                  title="Modificar datos"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Modificar
                                </button>

                                <button 
                                  onClick={() => handleToggleUserStatus(usr.id, isActivo)}
                                  className={`px-2.5 py-1 rounded-lg transition-colors font-medium inline-flex items-center gap-1 ${
                                    isActivo 
                                      ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white' 
                                      : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                                  }`}
                                  title={isActivo ? 'Desactivar acceso' : 'Activar acceso'}
                                >
                                  <Power className="w-3.5 h-3.5" /> {isActivo ? 'Desactivar' : 'Activar'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TABLA DE HABITACIONES */}
              {activeTab === 'habitaciones' && (
                <div className="overflow-x-auto pt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 px-4">Número de Habitación</th>
                        <th className="pb-3 px-4">Estado Operativo</th>
                        <th className="pb-3 px-4">Zona / Piso Asignado</th>
                        <th className="pb-3 px-4">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                      {filteredData().length === 0 ? (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-500">No hay habitaciones registradas.</td></tr>
                      ) : (
                        (filteredData() as HabitacionData[]).map((room) => (
                        <tr key={room.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 text-indigo-500 flex items-center justify-center font-bold text-xs"><DoorClosed className="w-3.5 h-3.5" /></div>
                            {room.room_number}
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              {room.status || 'Disponible'}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-medium text-indigo-500">{room.zonas?.nombre || 'Sin zona'}</td>
                          <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{room.room_type_config?.room_type || 'Estándar'}</td>
                        </tr>
                      ))
                    )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TABLA DE ZONAS / PISOS */}
              {activeTab === 'zonas' && (
                <div className="overflow-x-auto pt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 px-4">Nombre de Zona / Piso</th>
                        <th className="pb-3 px-4">Habitaciones Asociadas</th>
                        <th className="pb-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                      {filteredData().length === 0 ? (
                        <tr><td colSpan={3} className="py-8 text-center text-slate-500">No hay zonas registradas.</td></tr>
                      ) : (
                        (filteredData() as ZonaData[]).map((zona) => {
                          const cantidad = habitaciones.filter((h) => h.zona_id === zona.id).length;
                          return (
                            <tr key={zona.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">{zona.nombre}</td>
                              <td className="py-4 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                  {cantidad} {cantidad === 1 ? 'habitación' : 'habitaciones'}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <button
                                  onClick={() => {
                                    setZonaEditId(zona.id);
                                    setZonaEditName(zona.nombre || '');
                                    setModalType('editarZona');
                                    setIsModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors font-medium inline-flex items-center gap-1"
                                  title="Modificar nombre del piso"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Modificar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </section>
          )}

        </div>
      </main>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
<h3 className="text-base font-bold text-slate-900 dark:text-white">
                {modalType === 'zona' && 'Registrar Nueva Zona / Piso'}
                {modalType === 'editarZona' && 'Modificar Nombre del Piso'}
                {modalType === 'habitacion' && 'Crear Nueva Habitación'}
                {modalType === 'usuario' && 'Registrar Nuevo Usuario'}
                {modalType === 'editarUsuario' && 'Modificar Datos de Usuario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalType === 'zona' && (
              <form onSubmit={handleCreateZona} className="space-y-4">
                {/* Selector de modo de creación */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setZonaMode('rango'); setZonaError(''); }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                      zonaMode === 'rango'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-slate-50 dark:bg-[#0b0f19] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Rango Numérico
                  </button>
                  <button
                    type="button"
                    onClick={() => { setZonaMode('personalizado'); setZonaError(''); }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                      zonaMode === 'personalizado'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-slate-50 dark:bg-[#0b0f19] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    Especial / Personalizado
                  </button>
                </div>

                {zonaMode === 'rango' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Desde</label>
                        <input
                          type="number"
                          min={1}
                          value={zonaDesde}
                          onChange={(e) => { setZonaDesde(e.target.value); setZonaError(''); }}
                          placeholder={`Ej. ${computeNextNumericFloor(zonas)}`}
                          className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Hasta</label>
                        <input
                          type="number"
                          min={1}
                          value={zonaHasta}
                          onChange={(e) => { setZonaHasta(e.target.value); setZonaError(''); }}
                          placeholder="Ej. 5"
                          className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      El sistema genera automáticamente los pisos como <strong>Piso N</strong> en orden.
                      La secuencia numérica es obligatoria: actualmente el siguiente número disponible es{' '}
                      <strong className="text-indigo-500">{computeNextNumericFloor(zonas)}</strong>,
                      por lo que el rango debe comenzar estrictamente ahí (sin saltos) y no puede repetir pisos existentes.
                    </p>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nombre del Piso o Zona</label>
                      <input
                        type="text"
                        value={nombreZona}
                        onChange={(e) => { setNombreZona(e.target.value); setZonaError(''); }}
                        placeholder="Ej. Planta Baja, PB, Mezzanina"
                        className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Para nombres libres sin número (ej. Planta Baja, PB o Mezzanina). No se admiten nombres
                      repetidos ni pisos numéricos fuera de la secuencia.
                    </p>
                  </>
                )}

                {zonaError && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl px-3 py-2.5 text-[11px] font-medium">
                    {zonaError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25">Guardar</button>
                </div>
              </form>
            )}

            {modalType === 'editarZona' && (
              <form onSubmit={handleUpdateZona} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nombre del Piso o Zona</label>
                  <input
                    type="text"
                    value={zonaEditName}
                    onChange={(e) => setZonaEditName(e.target.value)}
                    placeholder="Ej. Piso 1"
                    className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Solo se permite corregir el tipeo del nombre. Los pisos no pueden eliminarse para proteger el historial;
                    las habitaciones asociadas se actualizan automáticamente.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25">Guardar Cambios</button>
                </div>
              </form>
            )}

            {modalType === 'habitacion' && (
              <form onSubmit={handleCreateHabitacion} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número Inicial</label>
                    <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Ej. 102" className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número Final (opcional)</label>
                    <input type="text" value={roomNumberEnd} onChange={(e) => setRoomNumberEnd(e.target.value)} placeholder="Ej. 107" className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Para una sola habitación deja el número final vacío. Para un lote indica el rango: 102 y 107 crea 102, 103, 104, 105, 106 y 107.
                </p>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Zona / Piso</label>
                  <select value={selectedZonaId} onChange={(e) => setSelectedZonaId(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required>
                    <option value="">Selecciona una zona...</option>
                    {zonas.map((z) => (<option key={z.id} value={z.id}>{z.nombre}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tipo de Habitación</label>
                  <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required>
                    {roomTypes.length > 0 ? (
                      roomTypes.map((t) => (<option key={t.id} value={t.id}>{t.room_type}</option>))
                    ) : (
                      <option value="">Sin tipos configurados</option>
                    )}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">El tipo seleccionado se aplicará a todas las habitaciones del lote.</p>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/25">Crear</button>
                </div>
              </form>
            )}

            {modalType === 'usuario' && (
              <form onSubmit={handleCreateUsuario} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nombre y Apellido</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Ej. Carlos Pérez" className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Correo Electrónico</label>
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="carlos@hotel.com" className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Rol</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                    <option value="recepcionista">Recepcionista</option>
                    <option value="limpieza">Personal de Limpieza</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25">Registrar</button>
                </div>
              </form>
            )}

            {modalType === 'editarUsuario' && (
              <form onSubmit={handleUpdateUsuario} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nombre y Apellido</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Rol</label>
                  <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                    <option value="recepcionista">Recepcionista</option>
                    <option value="limpieza">Personal de Limpieza</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nueva Contraseña (opcional)</label>
                  <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Dejar vacío para no cambiar" autoComplete="new-password" minLength={6} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
                  <p className="text-[10px] text-slate-400 mt-1">Mínimo 6 caracteres. Si se deja vacío, la contraseña no cambia.</p>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25">Guardar Cambios</button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
