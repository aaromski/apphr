'use client';

import { useState, useEffect } from 'react';
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
  Power
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AdminDashboardPage() {
  const router = useRouter();
  // Sección activa controlada por el menú lateral
  const [activeSection, setActiveSection] = useState<'dashboard' | 'parametrica' | 'usuarios'>('dashboard');
  // Pestaña interna (para la sección paramétrica / usuarios)
  const [activeTab, setActiveTab] = useState<'zonas' | 'habitaciones' | 'usuarios'>('habitaciones');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Estados de datos de Supabase
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [habitaciones, setHabitaciones] = useState<any[]>([]);
  const [zonas, setZonas] = useState<any[]>([]);
  
  // Estados para modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'zona' | 'habitacion' | 'usuario' | 'editarUsuario'>('habitacion');
  const [submitting, setSubmitting] = useState(false);

  // Campos de formularios
  const [nombreZona, setNombreZona] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [selectedZonaId, setSelectedZonaId] = useState('');
  const [roomType, setRoomType] = useState('Estándar');
  
  // Formulario de Usuario
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('recepcionista');

  const [kpis, setKpis] = useState({
    tiempoPromedio: '--',
    habitacionesLimpias: '0 / 0',
    alertasSla: '0',
    personalActivo: '0'
  });
  const [hotelInfo, setHotelInfo] = useState<{ name?: string } | null>(null);
  const [adminProfile, setAdminProfile] = useState<{ nombre?: string; role?: string } | null>(null);

  // Desglose analítico de limpiezas (métricas SLA por tipo y por personal de limpieza)
  const [analytics, setAnalytics] = useState({
    porTipo: [] as { tipo: string; promedio: number; limpiezas: number; cumplidas: number; slaPct: number }[],
    porPersonal: [] as { id: string; nombre: string; promedio: number; limpiezas: number; cumplidas: number; slaPct: number }[],
    totalLimpiezas: 0,
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);

    // 1. Usuario autenticado y su perfil (para el sidebar y el hotel)
    const { data: { user } } = await supabase.auth.getUser();
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
    let habQuery = supabase.from('rooms').select('*');
    let zonaQuery = supabase.from('zonas').select('*');
    let histQuery = supabase
      .from('historial_estados_habitacion')
      .select(`
        duracion_min,
        cumplio_sla,
        usuario_id,
        rooms ( room_type ),
        profiles ( nombre )
      `)
      .eq('estado_nuevo', 'Limpia/Lista');

    if (adminHotelId) {
      userQuery = userQuery.eq('hotel_id', adminHotelId);
      habQuery = habQuery.eq('hotel_id', adminHotelId);
      zonaQuery = zonaQuery.eq('hotel_id', adminHotelId);
      histQuery = histQuery.eq('hotel_id', adminHotelId);
    }

    const { data: userData } = await userQuery;
    const { data: habData } = await habQuery;
    const { data: zonaData } = await zonaQuery;
    const { data: histData } = await histQuery;

    if (userData) setUsuarios(userData);
    if (habData) setHabitaciones(habData);
    if (zonaData) setZonas(zonaData);

    // 4. Métricas reales desde el historial: promedio, SLA y desglose analítico
    const histRecords = (histData || []) as {
      duracion_min: number | null;
      cumplio_sla: boolean | null;
      usuario_id: string | null;
      rooms?: { room_type?: string | null } | { room_type?: string | null }[] | null;
      profiles?: { nombre?: string | null } | { nombre?: string | null }[] | null;
    }[];

    const completas = histRecords.filter((h) => typeof h.duracion_min === 'number');

    const getRoomType = (h: (typeof completas)[number]) => {
      const rt = h.rooms;
      if (Array.isArray(rt)) return rt[0]?.room_type || null;
      return rt?.room_type || null;
    };

    const getPersonalNombre = (h: (typeof completas)[number]) => {
      const p = h.profiles;
      if (Array.isArray(p)) return p[0]?.nombre || null;
      return p?.nombre || null;
    };

    // Promedio general
    const totalLimpiezas = completas.length;
    let tiempoPromedio = '--';
    if (totalLimpiezas) {
      const sum = completas.reduce((acc, h) => acc + (h.duracion_min || 0), 0);
      tiempoPromedio = `${Math.round(sum / totalLimpiezas)} min`;
    }

    // Contadores SLA cumplidas vs retrasadas
    const slaRetrasadas = completas.filter((h) => h.cumplio_sla === false).length;
    const slaCumplidas = completas.filter((h) => h.cumplio_sla === true).length;

    // Promedio por tipo de habitación
    const porTipoMap = new Map<string, { sum: number; n: number; cum: number }>();
    // Rendimiento por personal de limpieza
    const porPersonalMap = new Map<string, { sum: number; n: number; cum: number; nombre: string }>();

    completas.forEach((h) => {
      const tipo = getRoomType(h) || 'Estándar';
      const tipoBase = porTipoMap.get(tipo) || { sum: 0, n: 0, cum: 0 };
      tipoBase.sum += h.duracion_min || 0;
      tipoBase.n += 1;
      if (h.cumplio_sla === true) tipoBase.cum += 1;
      porTipoMap.set(tipo, tipoBase);

      const key = h.usuario_id || 'desconocido';
      const personalBase = porPersonalMap.get(key) || { sum: 0, n: 0, cum: 0, nombre: getPersonalNombre(h) || 'Personal' };
      personalBase.sum += h.duracion_min || 0;
      personalBase.n += 1;
      if (h.cumplio_sla === true) personalBase.cum += 1;
      porPersonalMap.set(key, personalBase);
    });

    const porTipo = [...porTipoMap.entries()]
      .map(([tipo, e]) => ({
        tipo,
        promedio: Math.round(e.sum / e.n),
        limpiezas: e.n,
        cumplidas: e.cum,
        slaPct: Math.round((e.cum / e.n) * 100),
      }))
      .sort((a, b) => b.limpiezas - a.limpiezas);

    const porPersonal = [...porPersonalMap.entries()]
      .map(([id, e]) => ({
        id,
        nombre: e.nombre,
        promedio: Math.round(e.sum / e.n),
        limpiezas: e.n,
        cumplidas: e.cum,
        slaPct: Math.round((e.cum / e.n) * 100),
      }))
      .sort((a, b) => b.limpiezas - a.limpiezas);

    setAnalytics({ porTipo, porPersonal, totalLimpiezas });

    // 5. KPIs calculados desde la BD
    const roomsData = (habData || []) as { status?: string | null }[];
    const usersData = (userData || []) as { activo?: boolean | null }[];
    setKpis({
      tiempoPromedio,
      habitacionesLimpias: `${roomsData.filter((h) => (h.status || '').toLowerCase() === 'limpia/lista').length} / ${roomsData.length}`,
      alertasSla: `${slaRetrasadas} / ${slaCumplidas}`,
      personalActivo: `${usersData.filter((u) => u.activo !== false).length} Agentes`
    });

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
      } else {
        alert('Usuario modificado correctamente.');
        setIsModalOpen(false);
        setSelectedUserId(null);
        setUserName('');
        setUserEmail('');
        setUserRole('recepcionista');
        fetchAdminData();
      }
    } catch (err: any) {
      alert('Ocurrió un error: ' + err.message);
    }
    setSubmitting(false);
  };

  // --- CREACIONES ---
  const handleCreateZona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreZona.trim()) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single();
      if (!profileData?.hotel_id) return;

      const { error } = await supabase.from('zonas').insert([{ nombre: nombreZona, hotel_id: profileData.hotel_id }]);
      if (error) alert('Error: ' + error.message);
      else { setNombreZona(''); setIsModalOpen(false); fetchAdminData(); }
    } catch (err: any) { alert('Error: ' + err.message); }
    setSubmitting(false);
  };

  const handleCreateHabitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !selectedZonaId) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single();
      if (!profileData?.hotel_id) return;

      const zonaSeleccionada = zonas.find(z => z.id === selectedZonaId);
      const { error } = await supabase.from('rooms').insert([{
        room_number: roomNumber,
        hotel_id: profileData.hotel_id,
        zona_id: selectedZonaId,
        zone: zonaSeleccionada ? zonaSeleccionada.nombre : '',
        room_type: roomType,
        status: 'Disponible'
      }]);

      if (error) alert('Error: ' + error.message);
      else { setRoomNumber(''); setSelectedZonaId(''); setIsModalOpen(false); fetchAdminData(); }
    } catch (err: any) { alert('Error: ' + err.message); }
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
    } catch (err: any) { alert('Error: ' + err.message); }
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
      
      {/* SIDEBAR */}
      <aside className="w-[260px] bg-white dark:bg-[#0b0f19] border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-5 select-none shrink-0">
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
              onClick={() => setActiveSection('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${activeSection === 'dashboard' ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Gerencial</span>
            </button>

            <button 
              onClick={() => { setActiveSection('parametrica'); setActiveTab('habitaciones'); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${activeSection === 'parametrica' ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <Sliders className="w-4 h-4" />
              <span>Gestión Paramétrica</span>
            </button>

            <button 
              onClick={() => { setActiveSection('usuarios'); setActiveTab('usuarios'); }}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-20 border-b border-slate-200 dark:border-slate-800/80 px-8 flex items-center justify-between bg-white/50 dark:bg-[#0b0f19]/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Panel de Administración General</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monitoreo operativo, control de personal y parámetros del hotel.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{hotelInfo?.name || 'Hotel no configurado'}</span>
            </div>
            <button onClick={fetchAdminData} className="p-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-indigo-500 transition-colors shadow-sm" title="Actualizar datos">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-6">
          
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
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Alertas SLA</span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><AlertTriangle className="w-4 h-4" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{kpis.alertasSla}</h3>
                  <p className="text-[11px] text-amber-500 font-medium mt-1">Retrasadas / Cumplidas (SLA)</p>
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
                    <div className="space-y-3.5">
                      {analytics.porTipo.map((t) => (
                        <div key={t.tipo} className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{t.tipo}</p>
                            <div className="h-1.5 mt-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${t.slaPct >= 80 ? 'bg-emerald-500' : t.slaPct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${t.slaPct}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white">{t.promedio} min</p>
                            <p className="text-[10px] text-slate-400">{t.limpiezas} limpiezas • {t.slaPct}% SLA</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rendimiento por personal de limpieza */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rendimiento por Personal</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tiempo promedio y cumplimiento de SLA</p>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500"><UserCheck className="w-4 h-4" /></div>
                  </div>

                  {analytics.porPersonal.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">Sin limpiezas registradas todavía.</p>
                  ) : (
                    <div className="space-y-3.5">
                      {analytics.porPersonal.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-full bg-indigo-600/10 text-indigo-500 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {c.nombre.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{c.nombre}</p>
                              <p className="text-[10px] text-slate-400">{c.limpiezas} limpiezas • {c.slaPct}% SLA cumplido</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white">{c.promedio} min</p>
                            <p className={`text-[10px] ${c.slaPct >= 80 ? 'text-emerald-500' : c.slaPct >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {c.cumplidas}/{c.limpiezas} cumplidas
                            </p>
                          </div>
                        </div>
                      ))}
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
                    Habitaciones & Inventario
                  </button>
                  <button
                    onClick={() => { setActiveTab('usuarios'); setActiveSection('usuarios'); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'usuarios' ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    Usuarios del Hotel
                  </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
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
                      if (activeTab === 'zonas') setModalType('zona');
                      else if (activeTab === 'habitaciones') setModalType('habitacion');
                      else { setModalType('usuario'); setUserName(''); setUserEmail(''); setUserRole('recepcionista'); }
                      setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    {activeTab === 'usuarios' ? 'Nuevo Usuario' : activeTab === 'habitaciones' ? 'Nueva Habitación' : 'Nueva Zona'}
                  </button>
                </div>
              </div>

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
                        filteredData().map((usr) => {
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
                      {filteredData().map((room) => (
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
                          <td className="py-4 px-4 font-medium text-indigo-500">{room.zone || 'Sin zona'}</td>
                          <td className="py-4 px-4 text-slate-500 dark:text-slate-400">{room.room_type || 'Estándar'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TABLA DE ZONAS */}
              {activeTab === 'zonas' && (
                <div className="overflow-x-auto pt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 px-4">Nombre de Zona / Piso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                      {filteredData().map((zona) => (
                        <tr key={zona.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">{zona.nombre}</td>
                        </tr>
                      ))}
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
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {modalType === 'zona' && 'Registrar Nueva Zona / Piso'}
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
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nombre del Piso o Zona</label>
                  <input type="text" value={nombreZona} onChange={(e) => setNombreZona(e.target.value)} placeholder="Ej. Planta Baja" className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25">Guardar</button>
                </div>
              </form>
            )}

            {modalType === 'habitacion' && (
              <form onSubmit={handleCreateHabitacion} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Número de Habitación</label>
                  <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Ej. 101" className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Zona / Piso</label>
                  <select value={selectedZonaId} onChange={(e) => setSelectedZonaId(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" required>
                    <option value="">Selecciona una zona...</option>
                    {zonas.map((z) => (<option key={z.id} value={z.id}>{z.nombre}</option>))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25">Crear</button>
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