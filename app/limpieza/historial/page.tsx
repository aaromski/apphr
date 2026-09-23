'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Calendar, Clock, User, AlertTriangle, Target } from 'lucide-react';

interface CicloLimpieza {
  id: string;
  habitacion_id: string;
  usuario_id: string | null;
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
  // Relación con la tabla de perfiles/usuarios para obtener el nombre
  profiles?: {
    nombre?: string | null;
  } | null;
}

export default function HistorialPage() {
  const [historial, setHistorial] = useState<CicloLimpieza[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorial = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      // Ajustamos el select para usar la relación con profiles (o usuarios)
      let query = supabase
        .from('ciclos_limpieza')
        .select(`
          id,
          habitacion_id,
          usuario_id,
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
          ),
          profiles:usuario_id (
            nombre
          )
        `)
        .not('finalizado_at', 'is', null)
        .order('finalizado_at', { ascending: false });

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('hotel_id')
          .eq('id', user.id)
          .single();
        if (profile?.hotel_id) {
          query = query.eq('hotel_id', profile.hotel_id);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error al cargar historial:', error.message);
      }

      if (data) {
        setHistorial(data as unknown as CicloLimpieza[]);
      }
      setLoading(false);
    };

    fetchHistorial();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Cargando historial...</div>;
  }

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          Completadas Hoy
        </h3>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
          {historial.length} Limpiezas
        </span>
      </div>

      <div className="space-y-3">
        {historial.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No hay limpiezas registradas todavía.
          </div>
        ) : (
          historial.map((item) => {
            // Obtenemos el nombre del perfil relacionado de forma segura
            const nombrePersonal = item.profiles?.nombre;

            return (
              <div key={item.id} className="bg-white dark:bg-[#131927] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <div>
                      <span className="font-bold text-base text-slate-900 dark:text-white">
                        Hab. {item.rooms?.room_number || 'N/A'}
                      </span>
                      <p className="text-xs text-slate-500">
                        {item.rooms?.room_type_config?.room_type || 'Estándar'} • {item.rooms?.zonas?.nombre || 'Piso 1'}
                      </p>
                    </div>
                  </div>
                  {item.cumplio_sla !== null && (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      item.cumplio_sla ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {item.cumplio_sla ? '✓ A tiempo' : '✗ Excedido'}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.duracion_min !== null ? `${item.duracion_min} min` : '—'}
                  </span>
                  {item.sla_min !== null && (
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      SLA {item.sla_min} min
                    </span>
                  )}
                  {item.minutos_excedidos !== null && item.minutos_excedidos > 0 && (
                    <span className="flex items-center gap-1 text-rose-500">
                      <AlertTriangle className="w-3 h-3" />
                      +{item.minutos_excedidos} min excedidos
                    </span>
                  )}
                  {nombrePersonal && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {nombrePersonal}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                  <span>Inicio: {item.iniciado_at ? new Date(item.iniciado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  <span>Fin: {new Date(item.finalizado_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}