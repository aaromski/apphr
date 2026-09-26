'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, Plus, Save, XCircle } from 'lucide-react';

interface Row {
  room_type: string;
  tiempo_estandar_min: number;
  sla_min: number;
  activo: boolean;
}

interface Feedback {
  type: 'ok' | 'error';
  text: string;
}

interface TiemposConfigProps {
  onTypeCreated?: (newType: { id: string; room_type: string; tiempo_estandar_min: number; sla_min: number }) => void;
}

export default function TiemposConfig() {
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tiposHotel, setTiposHotel] = useState<string[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [nuevoTiempoEstandar, setNuevoTiempoEstandar] = useState(30);
  const [nuevoSla, setNuevoSla] = useState(45);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const showFeedback = (type: Feedback['type'], text: string) => {
    setFeedback({ type, text });
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3500);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('hotel_id')
        .eq('id', user.id)
        .single();
      if (!profile?.hotel_id) { setLoading(false); return; }

      setHotelId(profile.hotel_id);

      const { data: cfg } = await supabase
        .from('room_type_config')
        .select('room_type, tiempo_estandar_min, sla_min, activo')
        .eq('hotel_id', profile.hotel_id)
        .order('room_type', { ascending: true });

      // Solo los tipos de habitación que el hotel ya usa en sus habitaciones
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('tipo_habitacion_id, room_type_config:tipo_habitacion_id ( room_type )')
        .eq('hotel_id', profile.hotel_id);

      const tipos = Array.from(
        new Set(((roomsData || []) as { room_type_config?: { room_type: string }[] | null }[]).map((r) => (r.room_type_config?.[0]?.room_type || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      setTiposHotel(tipos);
      setRows(
        (cfg || []).map((c) => ({
          room_type: c.room_type,
          tiempo_estandar_min: c.tiempo_estandar_min ?? 30,
          sla_min: c.sla_min ?? 45,
          activo: c.activo ?? true,
        }))
      );
      setLoading(false);
    };

    fetchConfig();
  }, []);

  const updateRow = (roomType: string, field: 'tiempo_estandar_min' | 'sla_min', value: number) => {
    setRows((prev) => prev.map((r) => (r.room_type === roomType ? { ...r, [field]: value } : r)));
  };

  const persist = async (row: Row) => {
    if (!hotelId) return;
    setSavingType(row.room_type);
    const { error } = await supabase.from('room_type_config').upsert(
      {
        hotel_id: hotelId,
        room_type: row.room_type,
        tiempo_estandar_min: row.tiempo_estandar_min,
        sla_min: row.sla_min,
        activo: row.activo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'hotel_id,room_type' }
    );
    setSavingType(null);
    if (error) showFeedback('error', `No se pudo guardar "${row.room_type}": ${error.message}`);
    else showFeedback('ok', `Tiempos de "${row.room_type}" guardados.`);
  };

  const handleSaveAll = async () => {
    if (!hotelId) return;
    const invalid = rows.find((r) => !r.room_type.trim() || r.tiempo_estandar_min < 1 || r.sla_min < 1);
    if (invalid) {
      showFeedback('error', 'Revisa los valores: el tiempo estándar y el tiempo límite deben ser mayores a 0.');
      return;
    }
    setSavingAll(true);
    const { error } = await supabase.from('room_type_config').upsert(
      rows.map((r) => ({
        hotel_id: hotelId,
        room_type: r.room_type,
        tiempo_estandar_min: r.tiempo_estandar_min,
        sla_min: r.sla_min,
        activo: r.activo,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'hotel_id,room_type' }
    );
    setSavingAll(false);
    if (error) showFeedback('error', 'No se pudieron guardar los tiempos: ' + error.message);
    else showFeedback('ok', 'Tiempos y controles de tiempo actualizados correctamente.');
  };

  const disponiblesParaAgregar = tiposHotel.filter(
    (t) => !rows.some((r) => r.room_type.toLowerCase() === t.toLowerCase())
  );

  const handleAdd = async () => {
    if (!hotelId) return;
    const tipo = nuevoTipo.trim();
    const tiempoEstandar = nuevoTiempoEstandar;
    const sla = nuevoSla;

    // Validación: campos obligatorios y valores positivos
    if (!tipo) {
      showFeedback('error', 'Escribe el nombre del tipo de habitación.');
      return;
    }
    if (tiempoEstandar < 1 || sla < 1) {
      showFeedback('error', 'El tiempo estándar y el tiempo límite deben ser mayores a 0.');
      return;
    }
    if (rows.some((r) => r.room_type.toLowerCase() === tipo.toLowerCase())) {
      showFeedback('error', 'Ese tipo de habitación ya está en la lista.');
      return;
    }

    setAdding(true);
    const { data: newRecord, error } = await supabase.from('room_type_config').insert({
      hotel_id: hotelId,
      room_type: tipo,
      tiempo_estandar_min: tiempoEstandar,
      sla_min: sla,
      activo: true,
      updated_at: new Date().toISOString(),
    })
    .select('id, room_type, tiempo_estandar_min, sla_min, activo')
    .single();
    setAdding(false);

    if (error) {
      showFeedback('error', `No se pudo agregar "${tipo}": ${error.message}`);
      return;
    }

    // Actualización instantánea de la lista sin recargar
    const nuevaFila: Row = { room_type: tipo, tiempo_estandar_min: tiempoEstandar, sla_min: sla, activo: true };
    setRows((prev) => [...prev, nuevaFila].sort((a, b) => a.room_type.localeCompare(b.room_type)));
    setNuevoTipo('');
    setNuevoTiempoEstandar(30);
    setNuevoSla(45);
    showFeedback('ok', `Tipo "${tipo}" agregado correctamente.`);

  if (newRecord && onTypeCreated) {
      onTypeCreated(newRecord);
    }
  };

  const toggleActive = async (roomType: string, currentlyActive: boolean) => {
    if (!hotelId) return;
    const newActive = !currentlyActive;
    const { error } = await supabase
      .from('room_type_config')
      .update({ activo: newActive, updated_at: new Date().toISOString() })
      .eq('hotel_id', hotelId)
      .eq('room_type', roomType);
    if (error) {
      showFeedback('error', `No se pudo ${newActive ? 'activar' : 'desactivar'}: ${error.message}`);
    } else {
      setRows((prev) => prev.map((r) => (r.room_type === roomType ? { ...r, activo: newActive } : r)));
      showFeedback('ok', `Tipo ${newActive ? 'activado' : 'desactivado'} correctamente.`);
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-400 py-10 text-center">Cargando configuración de tiempos...</p>;
  }

  return (
    <div className="pt-5 space-y-5">
      {feedback && (
        <div
          className={`fixed bottom-4 right-4 z-50 animate-slide-in flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all ${
            feedback.type === 'ok'
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }`}
          role="alert"
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}
      <div className="flex items-start gap-2 bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3">
        <Clock className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Define el <strong>tiempo estándar</strong> de limpieza y el <strong>tiempo límite</strong> por tipo de habitación.
          Se usan para el cronómetro del personal de limpieza, la barra de progreso y la clasificación de alertas.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 px-3">Tipo de Habitación</th>
              <th className="pb-3 px-3">Tiempo Estándar (min)</th>
              <th className="pb-3 px-3">Tiempo Límite (min)</th>
              <th className="pb-3 px-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-slate-500">Sin tipos configurados.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.room_type} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{row.room_type}</td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min={1}
                      value={row.tiempo_estandar_min}
                      onChange={(e) => updateRow(row.room_type, 'tiempo_estandar_min', Number(e.target.value))}
                      className="w-24 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min={1}
                      value={row.sla_min}
                      onChange={(e) => updateRow(row.room_type, 'sla_min', Number(e.target.value))}
                      className="w-24 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => persist(row)}
                      disabled={savingType === row.room_type}
                      className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      title="Guardar este tipo"
                    >
                      <Save className="w-3.5 h-3.5" /> {savingType === row.room_type ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => toggleActive(row.room_type, row.activo)}
                      className={`px-2.5 py-1 rounded-lg transition-colors font-medium inline-flex items-center gap-1 ${
                        row.activo
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500 hover:text-white'
                      }`}
                      title={row.activo ? 'Desactivar' : 'Activar'}
                    >
                      {row.activo ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Desactivar
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Activar
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1">
          <input
            list="room-type-options"
            type="text"
            value={nuevoTipo}
            onChange={(e) => setNuevoTipo(e.target.value)}
            placeholder="Agregar tipo de habitación..."
            className="w-full sm:w-64 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <datalist id="room-type-options">
            {disponiblesParaAgregar.map((t) => (<option key={t} value={t} />))}
          </datalist>
          <input
            type="number"
            min={1}
            max={480}
            value={nuevoTiempoEstandar}
            onChange={(e) => setNuevoTiempoEstandar(Number(e.target.value) || 0)}
            placeholder="Estándar (min)"
            className="w-36 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            title="Tiempo estándar de limpieza en minutos"
          />
          <input
            type="number"
            min={1}
            max={480}
            value={nuevoSla}
            onChange={(e) => setNuevoSla(Number(e.target.value) || 0)}
            placeholder="Límite/SLA (min)"
            className="w-36 bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            title="Tiempo límite/SLA en minutos"
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-500 hover:text-white rounded-xl px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> {adding ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={savingAll || rows.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs inline-flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {savingAll ? 'Guardando...' : 'Guardar Todo'}
        </button>
      </div>
    </div>
  );
}
