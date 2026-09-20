'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BedDouble, History, User, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  nombre: string;
  role: string;
}

export default function LimpiezaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('nombre, role')
          .eq('id', user.id)
          .single();

        if (data) {
          setProfile({
            nombre: data.nombre || 'Usuario',
            role: data.role || 'Limpieza',
          });
        }
      }
    };

    fetchProfile();
  }, []);

  const navItems = [
    { name: 'Habitaciones', href: '/limpieza', icon: BedDouble },
    { name: 'Historial', href: '/limpieza/historial', icon: History },
    { name: 'Perfil', href: '/limpieza/perfil', icon: User },
  ];

  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col pb-20 font-sans max-w-md mx-auto relative border-x border-slate-200 dark:border-slate-800 transition-colors duration-300">
      
      {/* HEADER DINÁMICO */}
      <header className="p-4 bg-white dark:bg-[#0C101D] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 transition-colors duration-300">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white font-bold p-1.5 rounded-lg text-xs flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-xl tracking-wide text-slate-900 dark:text-white">
              App<span className="text-indigo-600 dark:text-indigo-400">HR</span>
            </span>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold border border-indigo-200 dark:border-indigo-800/50 uppercase">
              {profile?.role || 'CARGANDO...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-medium hidden sm:inline">Realtime</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-300 border-2 border-indigo-600 dark:border-indigo-500 uppercase">
            {profile ? getInitial(profile.nombre) : '...'}
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-white leading-tight capitalize">
              {profile ? profile.nombre : 'Cargando usuario...'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
              {profile?.role || 'Personal'} • Zona Asignada
            </p>
          </div>
        </div>
      </header>

      {/* CONTENIDO DINÁMICO DE LA PÁGINA */}
      <div className="flex-1">
        {children}
      </div>

      {/* NAVEGACIÓN INFERIOR (TAB BAR) */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-[#0C101D] border-t border-slate-200 dark:border-slate-800 px-6 py-2.5 flex justify-around items-center z-20 transition-colors duration-300">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive 
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.name}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}