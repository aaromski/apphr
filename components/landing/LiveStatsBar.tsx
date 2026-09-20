'use client';

import { useEffect, useState, useRef } from 'react';
import { Wifi, Server, Activity, Database, Users, Shield, Zap, Globe } from 'lucide-react';

interface LiveMetric {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

const initialMetrics: LiveMetric[] = [
  {
    label: 'Conexión Multitenant',
    value: 'Estable',
    icon: Wifi,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    status: 'healthy',
    trend: 'stable',
  },
  {
    label: 'Latencia API',
    value: '42ms',
    icon: Zap,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    status: 'healthy',
    trend: 'down',
  },
  {
    label: 'WebSocket Activos',
    value: '1,247',
    icon: Activity,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
    status: 'healthy',
    trend: 'up',
  },
  {
    label: 'Consultas DB/min',
    value: '8.5K',
    icon: Database,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    status: 'healthy',
    trend: 'up',
  },
  {
    label: 'Usuarios Conectados',
    value: '342',
    icon: Users,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
    status: 'healthy',
    trend: 'stable',
  },
  {
    label: 'Seguridad RLS',
    value: 'Activa',
    icon: Shield,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500/10 dark:bg-rose-950/30',
    status: 'healthy',
    trend: 'stable',
  },
];

function LiveStatsBar() {
  const [metrics, setMetrics] = useState<LiveMetric[]>(initialMetrics);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulate real-time updates
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    intervalRef.current = setInterval(() => {
      setMetrics((prev) =>
        prev.map((metric) => {
          // Simulate small variations
          const shouldUpdate = Math.random() > 0.7;
          if (!shouldUpdate) return metric;

          let newValue = metric.value;
          let newTrend = metric.trend;

          switch (metric.label) {
            case 'Latencia API': {
              const base = 42;
              const variation = Math.floor(Math.random() * 15) - 5;
              newValue = `${Math.max(25, base + variation)}ms`;
              newTrend = variation > 0 ? 'up' : variation < 0 ? 'down' : 'stable';
              break;
            }
            case 'WebSocket Activos': {
              const base = 1247;
              const variation = Math.floor(Math.random() * 50) - 20;
              newValue = `${(base + variation).toLocaleString()}`;
              newTrend = variation > 0 ? 'up' : variation < 0 ? 'down' : 'stable';
              break;
            }
            case 'Consultas DB/min': {
              const base = 8500;
              const variation = Math.floor(Math.random() * 1000) - 400;
              newValue = `${((base + variation) / 1000).toFixed(1)}K`;
              newTrend = variation > 0 ? 'up' : variation < 0 ? 'down' : 'stable';
              break;
            }
            case 'Usuarios Conectados': {
              const base = 342;
              const variation = Math.floor(Math.random() * 20) - 8;
              newValue = `${Math.max(300, base + variation)}`;
              newTrend = variation > 0 ? 'up' : variation < 0 ? 'down' : 'stable';
              break;
            }
          }

          return { ...metric, value: newValue, trend: newTrend };
        })
      );
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible]);

  const statusColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-rose-500',
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    stable: '→',
  };

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
              <h3 className="text-lg font-bold text-white">Estado de la Plataforma en Vivo</h3>
              <p className="text-xs text-slate-400">Métricas actualizadas cada 3 segundos · Supabase Realtime</p>
            </div>
          </div>

          {/* Live badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-400">EN VIVO</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div
          className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} transition-all duration-700 ease-out`}
        >
          {metrics.map((metric, index) => (
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
                  className={`w-2 h-2 rounded-full ${statusColors[metric.status]} animate-pulse`}
                  aria-label={`Estado: ${metric.status}`}
                />
              </div>

              {/* Value */}
              <div className="text-2xl font-bold text-white tabular-nums mb-1">{metric.value}</div>

              {/* Label */}
              <div className="text-xs font-medium text-slate-300 mb-2">{metric.label}</div>

              {/* Trend */}
              <div className={`flex items-center gap-1 text-xs font-medium ${
                metric.trend === 'up' ? 'text-emerald-400' :
                metric.trend === 'down' ? 'text-rose-400' :
                'text-slate-500'
              }`}>
                <span aria-hidden="true">{trendIcons[metric.trend]}</span>
                <span className="capitalize">{metric.trend}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Global status bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>Regiones: <span className="font-medium text-white">3 activas</span> (US-East, EU-West, AP-Southeast)</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Certificaciones: <span className="font-medium text-white">SOC2 Type II, ISO 27001, GDPR</span></span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Ver Dashboard de Estado →
              </a>
              <a
                href="#"
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Suscribirse a Incidentes
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LiveStatsBar;