'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Building2, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  borderColor: string;
  bgColor: string;
}

const trustStats: StatItem[] = [
  {
    label: 'Hoteles Activos',
    value: '247+',
    icon: <Building2 className="w-5 h-5" />,
    description: 'En 12 países',
    borderColor: 'border-indigo-500/20 dark:border-indigo-500/30',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
  },
  {
    label: 'Limpiezas/Día',
    value: '12.5K+',
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Procesadas en tiempo real',
    borderColor: 'border-emerald-500/20 dark:border-emerald-500/30',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
  },
  {
    label: 'Tiempo Promedio',
    value: '28 min',
    icon: <Clock className="w-5 h-5" />,
    description: 'Por habitación estándar',
    borderColor: 'border-amber-500/20 dark:border-amber-500/30',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
  },
  {
    label: 'Cumplimiento SLA',
    value: '94.2%',
    icon: <CheckCircle2 className="w-5 h-5" />,
    description: 'En tiempo límite',
    borderColor: 'border-violet-500/20 dark:border-violet-500/30',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
  },
];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Background decorative glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none -z-10" aria-hidden="true" />
      <div className="absolute bottom-1/3 right-10 w-[450px] h-[450px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" aria-hidden="true" />

      {/* Trust Badge / Version Pill */}
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 mb-8 shadow-sm ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} transition-all duration-700 ease-out`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
        </span>
        <span>Plataforma Multitenant de Gestión Hotelera en Tiempo Real</span>
      </div>

      {/* Main Headline */}
      <div className={`text-center ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out delay-100`}>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
          Optimiza la rotación de habitaciones y controla tus{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400">
            tiempos de limpieza
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Sincroniza recepción, camareras y gerencia sin llamadas por radio. Monitorea el cumplimiento de los tiempos límite en tiempo
          real y agiliza los check-ins con tableros interactivos e intuitivos.
        </p>
      </div>

      {/* CTAs */}
      <div className={`mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out delay-200`}>
        <Link
          href="/registro"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl shadow-indigo-600/30 active:scale-[0.98] transition-all relative overflow-hidden group"
        >
          <span className="relative z-10">Registrar mi Hotel</span>
          <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
          <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        <Link
          href="/login"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold bg-white/80 dark:bg-[#111625]/80 backdrop-blur-md text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm active:scale-[0.98] transition-all"
        >
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Acceso al Sistema</span>
        </Link>
      </div>

      {/* Trust Stats */}
      <div className={`mt-16 pt-12 border-t border-slate-200/80 dark:border-slate-800/80 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out delay-300`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {trustStats.map((stat, index) => (
            <div
              key={stat.label}
              className={`p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-[#111625]/60 border ${stat.borderColor} transition-all duration-300 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${stat.bgColor} text-indigo-600 dark:text-indigo-400 mb-4`}>
                {stat.icon}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{stat.label}</div>
              {stat.description && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{stat.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}