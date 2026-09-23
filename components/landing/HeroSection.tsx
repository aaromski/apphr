'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Database, Wifi, Globe } from 'lucide-react';

const APK_DOWNLOAD_URL = '/downloads/apphr-mobile.apk';

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
        <span>Plataforma Inteligente de Gestión y Control Hotelero en Tiempo Real</span>
      </div>

      {/* Main Headline */}
      <div className={`text-center ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out delay-100`}>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          Reduce los tiempos de espera de las habitaciones al instante.
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Sincronización instantánea entre Recepción, Camareras y Gerencia. Elimina llamadas por radio, hojas de papel y tiempos muertos en la rotación de habitaciones de tu hotel.
        </p>
      </div>

      {/* Business Pillars */}
      <div className={`mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out delay-200`}>
        <BusinessPillar
          icon={<Database className="w-5 h-5" />}
          label="Seguridad y Privacidad"
          desc="Cada hotel opera en un entorno blindado e independiente."
        />
        <BusinessPillar
          icon={<Wifi className="w-5 h-5" />}
          label="Sincronización Instantánea"
          desc="Toda la información fluye al segundo entre áreas sin recargar."
        />
        <BusinessPillar
          icon={<Zap className="w-5 h-5" />}
          label="Automatización de Avisos"
          desc="Notificaciones automáticas del check-out a la limpieza."
        />
        <BusinessPillar
          icon={<Globe className="w-5 h-5" />}
          label="Optimizado para Móviles"
          desc="Funciona rápido en teléfonos y tablets del personal."
        />
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

      {/* APK Download Section */}
      <div className={`mt-16 pt-12 border-t border-slate-200/80 dark:border-slate-800/80 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out delay-300`}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 mb-4 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>App Móvil para Personal de Limpieza y Recepción</span>
          </div>
          
          <a
            href={APK_DOWNLOAD_URL}
            download
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition-all relative overflow-hidden group"
          >
            <span className="relative z-10">Descargar Aplicación Android</span>
            <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
            </svg>
          </a>
          
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Instalación directa para dispositivos del personal. Compatible con Android 8.0+
          </p>
        </div>
      </div>
    </section>
  );
}

function BusinessPillar({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
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