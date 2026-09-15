'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut, Award, Shield, Bell, Hotel, UserCheck } from 'lucide-react';

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

export default function PerfilPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchProfileData = async () => {
      // 1. Obtener usuario de la sesión de Supabase Auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setLoading(false);
        return;
      }

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
        // Adaptar estructura relational de Supabase
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
    router.push('/login');
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

  return (
    <main className="p-4 space-y-4">
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
        <button className="w-full p-4 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <Award className="w-4 h-4 text-indigo-500" />
            <span>Desempeño y Métricas</span>
          </div>
          <span className="text-slate-400 font-semibold">&gt;</span>
        </button>
        <button className="w-full p-4 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-indigo-500" />
            <span>Notificaciones del Turno</span>
          </div>
          <span className="text-slate-400 font-semibold">&gt;</span>
        </button>
        <button className="w-full p-4 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-indigo-500" />
            <span>Seguridad</span>
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
    </main>
  );
}