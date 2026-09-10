'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ShieldCheck, 
  Building2, 
  Search, 
  Bell, 
  MoreVertical, 
  Clock, 
  ChevronDown,
  LayoutGrid,
  CheckCircle2,
  X
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Room {
  id: string;
  room_number: string;
  status: 'Disponible' | 'Ocupada' | 'Sucia' | 'En Limpieza';
  room_type: string;
  zone: string;
  cleaning_timer?: string;
}

export default function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; visible: boolean } | null>(null);

  useEffect(() => {
    async function fetchRooms() {
      const { data, error } = await supabase.from('rooms').select('*').order('room_number', { ascending: true });
      if (error) {
        console.error('Error cargando habitaciones:', error.message);
      } else {
        setRooms(data || []);
      }
      setLoading(false);
    }
    fetchRooms();
  }, []);

  // Contadores
  const counts = {
    disponibles: rooms.filter(r => r.status === 'Disponible').length,
    ocupadas: rooms.filter(r => r.status === 'Ocupada').length,
    limpieza: rooms.filter(r => r.status === 'En Limpieza').length,
    sucias: rooms.filter(r => r.status === 'Sucia').length,
  };

  // Filtrado
  const filteredRooms = rooms.filter(room => {
    const matchesFilter = activeFilter === 'Todos' || room.status === activeFilter;
    const matchesSearch = room.room_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-200 font-sans flex flex-col transition-colors duration-300">
      
      {/* Navbar Superior */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#111625]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white tracking-wide">AppHR</span>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Grand Hotel Guayana</span>
          </div>
        </div>

        {/* Indicador Realtime, Búsqueda, ThemeToggle y Perfil */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            Sincronización en Realtime Activa
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar habitación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-700/80 rounded-xl py-1.5 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 w-48 focus:w-64 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Botón para alternar tema */}
          <ThemeToggle />

          <button className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 bg-indigo-500 rounded-full absolute top-1.5 right-1.5" />
          </button>

          <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-800 dark:text-white">
              RH
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-900 dark:text-white leading-none">Recepción</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Turno Mañana</div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 px-6 py-6 max-w-[1600px] w-full mx-auto">
        
        {/* Filtros y Métricas */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <button className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors">
              <LayoutGrid className="w-3.5 h-3.5" />
              Todas las Zonas
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-1.5 bg-white dark:bg-[#111625] p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
              {['Todos', 'Disponible', 'Ocupada', 'Sucia', 'En Limpieza'].map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveFilter(status)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
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

          {/* Badge Resumen */}
          <div className="flex items-center gap-2 text-xs font-medium bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800/80 p-1.5 rounded-xl shadow-sm">
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.disponibles}</strong> Disponibles
            </span>
            <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.ocupadas}</strong> Ocupadas
            </span>
            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.limpieza}</strong> En Limpieza
            </span>
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg">
              <strong className="font-bold">{counts.sucias}</strong> Sucias
            </span>
          </div>
        </div>

        {/* Título de Sección */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
            Vista de Planta Principal
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando {filteredRooms.length} habitaciones
          </span>
        </div>

        {/* Grid de Habitaciones */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-xs">Cargando habitaciones...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredRooms.map((room) => {
              const statusStyles = {
                Disponible: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                Ocupada: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                Sucia: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700',
                'En Limpieza': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
              };

              return (
                <div
                  key={room.id}
                  className="bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all hover:shadow-xl relative group shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {room.room_number}
                      </span>
                      <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/50">
                        {room.room_type || 'Estándar'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusStyles[room.status]}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {room.status}
                    </span>

                    {room.cleaning_timer && (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {room.cleaning_timer}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Notificación Flotante */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-white dark:bg-[#111625] border border-emerald-500/30 p-4 rounded-2xl shadow-2xl flex items-start gap-3 max-w-sm z-50">
          <div className="w-7 h-7 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{notification.message}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Hace un momento</p>
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