'use client';

import { useEffect, useState } from 'react';
import { Wifi, Server, Activity, Database, Users, Shield, Zap, Globe, CheckCircle2 } from 'lucide-react';

interface LiveMetric {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  status: 'healthy' | 'warning' | 'critical';
  description: string;
}

const platformMetrics = [
  {
    label: 'Arquitectura',
    value: 'Jamstack/Serverless',
    icon: Globe,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    status: 'healthy',
    description: 'Next.js 16 + Supabase Edge',
  },
  {
    label: 'Base de Datos',
    value: 'PostgreSQL + RLS',
    icon: Database,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    status: 'healthy',
    description: 'Row Level Security nativo',
  },
  {
    label: 'Tiempo Real',
    value: 'Supabase Realtime',
    icon: Activity,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
    status: 'healthy',
    description: 'WebSockets nativos < 2s',
  },
  {
    label: 'Edge Runtime',
    value: 'Deno Edge Functions',
    icon: Server,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
    status: 'healthy',
    description: 'Edge Functions para webhooks',
  },
  {
    label: 'Automatización',
    value: 'n8n / Power Automate',
    icon: Zap,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    status: 'healthy',
    description: 'Webhooks HTTP con HMAC',
  },
  {
    label: 'Mobile PWA',
    value: 'PWA Instalable',
    icon: Globe,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    status: 'healthy',
    description: 'PWA instalable, offline-first',
  },
];

function LiveStatsBar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const statusColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-rose-500',
  } as const;

  return (
    <section className="relative overflow-hidden bg-slate-900/95 dark:bg-slate-950/95 border-t border-slate-800/50">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-transparent to-violet-600/10" aria-hidden="true" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
              <Server className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Estado de la Plataforma</h3>
              <p className="text-xs text-slate-400">Capacidades técnicas verificables · Sin métricas simuladas</p>
            </div>
          </div>

          {/* Live badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-400">SISTEMA OPERATIVO</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div
          className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} transition-all duration-700 ease-out`}
        >
          {platformMetrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`relative p-4 rounded-xl border ${metric.bgColor} border-slate-800/50 transition-all duration-300 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              {/* Status indicator */}
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${metric.bgColor}`}>
                  <metric.icon className="w-5 h-5" style={{ color: metric.color }} />
                </div>
                <div
                  className={`w-2 h-2 rounded-full ${statusColors[metric.status as keyof typeof statusColors]} animate-pulse`}
                  aria-label={`Estado: ${metric.status}`}
                />
              </div>

              {/* Label */}
              <div className="text-xs font-medium text-slate-300 mb-2">{metric.label}</div>

              {/* Value */}
              <div className="text-lg font-bold text-white tabular-nums mb-2">{metric.value}</div>

              {/* Description */}
              <div className="text-[10px] text-slate-400 leading-relaxed">{metric.description}</div>
            </div>
          ))}
        </div>

        {/* Global status bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Seguridad: <span className="font-medium text-white">RLS PostgreSQL nativo</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Edge Runtime: <span className="font-medium text-white">Deno (Supabase Edge)</span></span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Ver documentación técnica →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LiveStatsBar;