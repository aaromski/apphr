'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, ShieldCheck, Clock, Zap, Database, Wifi, Globe } from 'lucide-react';

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
        <span>Plataforma Multitenant de Gestión Hotelera en Tiempo Real · Next.js + Supabase</span>
      </div>

      {/* Main Headline */}
      <div className={`text-center ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out delay-100`}>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
          Elimina la latencia entre Recepción y Limpieza
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400">
            {'de 45\u201390 min a < 2 segundos'}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Sincronización instantánea entre Recepción, Camareras y Gerencia mediante WebSockets nativos (Supabase Realtime).
          Elimina llamadas por radio, hojas de papel y tiempos muertos en la rotación de habitaciones.
        </p>
      </div>

      {/* Technical Pillars */}
      <div className={`mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out delay-200`}>
        <TechnicalPillar
          icon={<Database className="w-5 h-5" />}
          label="Arquitectura Jamstack/Serverless"
          desc="Next.js 16 (App Router) + Supabase (PostgreSQL + Auth + Realtime + Edge Functions)"
        />
        <TechnicalPillar
          icon={<Wifi className="w-5 h-5" />}
          label="WebSockets Nativos"
          desc="Supabase Realtime: latencia < 2s, reconexión automática, offline-first ready"
        />
        <TechnicalPillar
          icon={<Zap className="w-5 h-5" />}
          label="Flujos Automatizados n8n"
          desc="Webhooks HTTP a n8n/Power Automate/Make: check-out → sucia → asignación → notificación"
        />
        <TechnicalPillar
          icon={<Globe className="w-5 h-5" />}
          label="Mobile-First Táctil"
          desc="PWA instalable, botones 48px, cronómetro visual, alertas SLA, offline-first"
        />
      </div>

      {/* CTAs */}
      <div className={`mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out delay-200`}>
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

      {/* Technical Trust Indicators */}
      <div className={`mt-16 pt-12 border-t border-slate-200/80 dark:border-slate-800/80 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out delay-300`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <TrustIndicator
            icon={<ShieldCheck className="w-5 h-5" />}
            label="Multi-Tenant RLS"
            value="Aislamiento estricto"
            desc="Row Level Security por hotel_id en PostgreSQL"
          />
          <TrustIndicator
            icon={<Wifi className="w-5 h-5" />}
            label="Realtime < 2s"
            value="WebSockets nativos"
            desc="Supabase Realtime sin configuración extra"
          />
          <TrustIndicator
            icon={<Zap className="w-5 h-5" />}
            label="Automatización"
            value="n8n / Power Automate"
            desc="Webhooks HTTP con reintentos y logs"
          />
          <TrustIndicator
            icon={<Globe className="w-5 h-5" />}
            label="PWA Instalable"
            value="iOS / Android"
            desc="Offline-first, push notifications, background sync"
          />
        </div>
      </div>
    </section>
  );
}

function TechnicalPillar({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-[#111625]/60 border border-slate-200/60 dark:border-slate-800/60 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10">
      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{label}</h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function TrustIndicator({ icon, label, value, desc }: { icon: React.ReactNode; label: string; value: string; desc: string }) {
  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-[#111625]/60 border border-slate-200/60 dark:border-slate-800/60 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{value}</div>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}