'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  Building2,
  Sparkles,
  BedDouble,
  BarChart3,
  ArrowRight,
  LogIn,
  CheckCircle2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-200 flex flex-col font-sans transition-colors duration-300 relative overflow-hidden">
      {/* Resplandores de fondo decorativos */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/3 right-10 w-[450px] h-[450px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Barra de Navegación Superior */}
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#0b0f19]/70 backdrop-blur-md sticky top-0 z-30 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logotipo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                AppHR
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Hotel Management</span>
            </div>
          </Link>

          {/* Menú y Acciones */}
          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle />

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </Link>

            <Link
              href="/registro"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Registrar Hotel</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        {/* Pill de versión / tecnología */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Plataforma Multitenant de Gestión Hotelera en Tiempo Real</span>
        </div>

        {/* Título Principal */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          Optimiza la rotación de habitaciones y controla tus{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500 dark:from-indigo-400 dark:to-violet-400">
            tiempos de limpieza
          </span>
        </h1>

        {/* Subtítulo */}
        <p className="mt-6 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Sincroniza recepción, camareras y gerencia sin llamadas por radio. Monitorea el cumplimiento de los tiempos límite en tiempo
          real y agiliza los check-ins con tableros interactivos e intuitivos.
        </p>

        {/* Botones de Llamado a la Acción (CTAs) */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/registro"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/25 active:scale-[0.98] transition-all"
          >
            <span>Registrar mi Hotel</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-[#111625] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm active:scale-[0.98] transition-all"
          >
            <LogIn className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Acceso al Sistema (Login)</span>
          </Link>
        </div>

        {/* Badges de Confianza / Métricas */}
        <div className="mt-12 pt-8 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="p-3 rounded-xl bg-white/60 dark:bg-[#111625]/60 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sincronización</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">Velocidad Extrema</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Actualizaciones instantáneas en todos los dispositivos, sin demoras ni necesidad de actualizar la pantalla.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/60 dark:bg-[#111625]/60 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Control de Tiempos</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">Cero Retrasos</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Alertas automáticas y semáforos visuales para supervisar el ritmo de limpieza en tiempo real.</div>
          </div>

          <div className="p-3 rounded-xl bg-white/60 dark:bg-[#111625]/60 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Diseño Móvil</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">Ultra Simple</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Interfaz ultra simple y táctil, pensada para que el personal de limpieza trabaje sin complicaciones desde su teléfono.</div>
          </div>

          <div className="p-3 rounded-xl bg-white/60 dark:bg-[#111625]/60 border border-slate-200/60 dark:border-slate-800/60">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Seguridad</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">100% Privado</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Entornos de trabajo independientes y seguros para garantizar la confidencialidad de la información de tu hotel.</div>
          </div>
        </div>
      </section>

      {/* Características Principales / Módulos Operativos */}
      <section className="py-16 bg-white/50 dark:bg-[#0e1320]/50 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Arquitectura Modular
            </h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Diseñado para cada integrante de tu operación
            </p>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Cada perfil cuenta con una interfaz enfocada y herramientas optimizadas para su rol diario.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Recepción */}
            <div className="bg-white dark:bg-[#111625] rounded-2xl p-6 border border-slate-200 dark:border-slate-800/80 shadow-md hover:border-indigo-500/40 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                  <BedDouble className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Recepción Realtime</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Tablero de habitaciones en vivo. Visualiza al instante qué unidades están disponibles, en limpieza o
                  listas para check-in. Notificaciones inmediatas tras cada finalización.
                </p>

                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Transiciones de estado protegidas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Disparador de check-out automatizado</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                <span>Rol: Recepcionista</span>
              </div>
            </div>

            {/* Card 2: Personal de Limpieza */}
            <div className="bg-white dark:bg-[#111625] rounded-2xl p-6 border border-slate-200 dark:border-slate-800/80 shadow-md hover:border-indigo-500/40 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Panel Móvil One-Touch</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Pensado para pantallas táctiles de camareras. Un solo toque inicia y finaliza la limpieza,
                  acompañado de cronómetro activo con indicador visual de tiempo restante y tiempo límite.
                </p>

                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Botones ergonómicos de 48px</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Bitácora de habitaciones limpiadas</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span>Rol: Limpieza</span>
              </div>
            </div>

            {/* Card 3: Administración y KPIs */}
            <div className="bg-white dark:bg-[#111625] rounded-2xl p-6 border border-slate-200 dark:border-slate-800/80 shadow-md hover:border-indigo-500/40 transition-colors flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Dashboard Gerencial</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Supervisa la eficiencia global: tasa de cumplimiento a tiempo, tiempos promedio por categoría de habitación,
                  gestión de usuarios y configuración paramétrica de zonas y tiempos.
                </p>

                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span>Actualización instantánea de rendimiento</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span>Parametrización por tipo de habitación</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-violet-600 dark:text-violet-400 flex items-center justify-between">
                <span>Rol: Administrador</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner de Invitación al Registro */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-900/90 dark:to-[#111625] rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            ¿Listo para llevar la gestión de tu hotel al siguiente nivel?
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-indigo-100 max-w-xl mx-auto leading-relaxed">
            Registra tu hotel en pocos segundos, obtén tu código de inquilino exclusivo y comienza a optimizar los tiempos
            de asignación y limpieza.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/registro"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg active:scale-[0.98] transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span>Registrar Hotel Ahora</span>
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-indigo-700/50 hover:bg-indigo-700 text-white border border-indigo-400/30 active:scale-[0.98] transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Ya tengo cuenta</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Público */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] py-8 text-xs text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">AppHR</span>
            <span>— © 2026 AppHR Technologies. Todos los derechos reservados.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Iniciar Sesión
            </Link>
            <Link href="/registro" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Registrar Hotel
            </Link>
            <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Documentación
            </a>
            <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Soporte
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}