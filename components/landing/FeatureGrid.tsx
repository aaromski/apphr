'use client';

import { useEffect, useRef } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  BarChart3,
  Wifi,
  Users,
  CheckCircle2,
  Smartphone,
  Database,
  Bell,
  Target,
} from 'lucide-react';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  highlights: string[];
  technicalDetails: string;
}

const features: Feature[] = [
  {
    icon: Sparkles,
    title: 'Sincronización en Tiempo Real',
    description: 'Actualizaciones instantáneas en todos los dispositivos sin recargar. WebSocket nativo con Supabase Realtime para latencia sub-segundo.',
    color: 'from-indigo-500 to-violet-500',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-500/20 dark:border-indigo-500/30',
    highlights: ['WebSocket nativo Supabase', 'Latencia < 2s end-to-end', 'Reconexión automática', 'Offline-first ready'],
    technicalDetails: 'Supabase Realtime (PostgreSQL logical replication) → WebSocket → cliente Next.js'
  },
  {
    icon: ShieldCheck,
    title: 'Seguridad Multitenant (RLS)',
    description: 'Aislamiento total de datos por hotel con Row Level Security a nivel de base de datos. Cada hotel opera en su entorno seguro e independiente.',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-500/20 dark:border-emerald-500/30',
    highlights: ['PostgreSQL RLS nativo', 'Aislamiento por hotel_id', 'Políticas por rol (Admin/Recepción/Limpieza)', 'Auditoría completa en historial_estados_habitacion'],
    technicalDetails: 'RLS policies en PostgreSQL: hotel_id = auth.jwt() → hotel_id del usuario'
  },
  {
    icon: Zap,
    title: 'Panel Móvil One-Touch',
    description: 'Interfaz táctil optimizada para camareras. Botones ergonómicos de 48px, cronómetro activo con indicador visual de tiempo restante y alertas de tiempo límite.',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    borderColor: 'border-amber-500/20 dark:border-amber-500/30',
    highlights: ['Touch-first 48px targets', 'Cronómetro visual server-synced', 'Alertas SLA escalonadas', 'Funciona offline con sync posterior'],
    technicalDetails: 'PWA + Service Worker + IndexedDB para offline + Background Sync API'
  },
  {
    icon: BarChart3,
    title: 'Analytics Gerencial Avanzado',
    description: 'KPIs en vivo: tiempo promedio, cumplimiento SLA, rendimiento por personal/zona/tipo. Gráficos interactivos con Recharts y exportación CSV.',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
    borderColor: 'border-violet-500/20 dark:border-violet-500/30',
    highlights: ['Tiempo real (Supabase Realtime)', 'Por personal/zona/tipo de habitación', 'Export CSV/PDF', 'Alertas automáticas por SLA'],
    technicalDetails: 'Recharts + Supabase Realtime subscriptions → métricas materializadas (metricas_limpieza_detalle)'
  },
  {
    icon: Wifi,
    title: 'Automatización Check-out n8n',
    description: 'Webhooks a n8n/Power Automate/Make para disparar flujos: habitación sucia → asignación limpieza → notificación recepción → reporte gerencial.',
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-500/20 dark:border-cyan-500/30',
    highlights: ['Webhooks HTTP firmados', 'n8n/Make/Power Automate', 'Reintentos automáticos con backoff', 'Logs de ejecución y trazabilidad'],
    technicalDetails: 'Edge Functions (Deno) → HTTP webhook → n8n/Power Automate/Make con HMAC verification'
  },
  {
    icon: Users,
    title: 'Gestión de Equipos y Roles',
    description: 'Roles granulares (Admin, Recepción, Limpieza, Mantenimiento), invitaciones por email, 2FA opcional, auditoría de cambios y suspensión temporal.',
    color: 'from-rose-500 to-pink-500',
    bgColor: 'bg-rose-500/10 dark:bg-rose-950/30',
    borderColor: 'border-rose-500/20 dark:border-rose-500/30',
    highlights: ['RBAC granular (4 roles base)', 'Invitaciones por email con token', '2FA TOTP opcional', 'Log de auditoría inmutable'],
    technicalDetails: 'Supabase Auth + custom claims (JWT) + RLS policies por rol + trigger de auditoría'
  },
];

interface FeatureCardProps {
  feature: Feature;
  index: number;
  isVisible: boolean;
}

function FeatureCard({ feature, index, isVisible }: FeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && cardRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
      );
      observer.observe(cardRef.current);
      return () => observer.disconnect();
    }
  }, [isVisible]);

  return (
    <div
      ref={cardRef}
      className={`group relative overflow-hidden rounded-2xl p-6 border transition-all duration-500 hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 ${feature.borderColor} bg-white/50 dark:bg-[#111625]/50 backdrop-blur-sm ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Gradient border glow on hover */}
      <div
        className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
        style={{
          background: `linear-gradient(135deg, ${feature.color.replace('from-', '').replace('to-', '')})`,
          filter: 'blur(8px)',
        }}
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className={`relative w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 ${feature.bgColor} text-indigo-600 dark:text-indigo-400`}
      >
        <feature.icon className="w-6 h-6" aria-hidden="true" />
        {/* Pulse ring on hover */}
        <div className="absolute inset-0 rounded-xl border-2 border-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </div>

      {/* Content */}
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">{feature.description}</p>

      {/* Highlights */}
      <div className="space-y-2">
        {feature.highlights.map((highlight, i) => (
          <div
            key={highlight}
            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors"
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span>{highlight}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FeatureGridProps {
  isVisible: boolean;
}

export function FeatureGrid({ isVisible }: FeatureGridProps) {
  return (
    <section id="features" className="py-20 bg-white/50 dark:bg-[#0e1320]/50 border-y border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Capacidades por Rol
          </h2>
          <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Diseñado para cada integrante de tu operación
          </p>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Cada perfil cuenta con una interfaz enfocada y herramientas optimizadas para su rol diario.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} isVisible={isVisible} />
          ))}
        </div>

        {/* Additional Feature Row - Mobile & Integration Focus */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Smartphone,
              title: 'PWA Nativa',
              desc: 'Instalable en iOS/Android, notificaciones push, sincronización en background, funciona offline.',
            },
            {
              icon: Database,
              title: 'PostgreSQL + Supabase',
              desc: 'Base de datos robusta con triggers automáticos, funciones RPC, y realtime nativo sin configuración extra.',
            },
            {
              icon: Bell,
              title: 'Notificaciones Inteligentes',
              desc: 'Push, email, in-app y webhooks. Reglas configurables por rol, zona y prioridad de habitación.',
            },
            {
              icon: Target,
              title: 'SLA Parametrizable',
              desc: 'Tiempos estándar y límite por tipo de habitación. Alertas escalonadas: warning → critical → escalation.',
            },
          ].map((item, index) => (
            <div
              key={item.title}
              className={`p-5 rounded-2xl bg-white/60 dark:bg-[#111625]/60 border border-slate-200/60 dark:border-slate-800/60 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-lg ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out`}
              style={{ transitionDelay: `${(6 + index) * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <item.icon className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">{item.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}