'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Calendar } from 'lucide-react';

interface HistorialItem {
  id: string;
  estado_nuevo: string;
  fecha_cambio: string;
  rooms: {
    room_number: string;
    room_type: string;
    zone: string;
  } | null;
}

export default function HistorialPage() {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorial = async () => {
      // Obtenemos solo los registros del usuario actual logueado (opcional pero recomendado)
      const { data: { user } } = await supabase.auth.getUser();

      // Consultamos la tabla de historial real haciendo un join con rooms
      let query = supabase
        .from('historial_estados_habitacion')
        .select(`
          id,
          estado_nuevo,
          fecha_cambio,
          rooms (
            room_number,
            room_type,
            zone
          )
        `)
        .eq('estado_nuevo', 'Limpia/Lista')
        .order('fecha_cambio', { ascending: false });

      if (user) {
        // Opcional: si quieres ver solo lo que limpió este usuario específico
        // query = query.eq('usuario_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error al cargar historial:', error.message);
      }

      if (data) {
        setHistorial(data as unknown as HistorialItem[]);
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
          historial.map((item) => (
            <div key={item.id} className="bg-white dark:bg-[#131927] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <div>
                  <span className="font-bold text-base text-slate-900 dark:text-white">
                    Hab. {item.rooms?.room_number || 'N/A'}
                  </span>
                  <p className="text-xs text-slate-500">
                    {item.rooms?.room_type || 'Estándar'} • {item.rooms?.zone || 'Piso 1'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-slate-400">
                {new Date(item.fecha_cambio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}