'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Sparkles, Clock, CheckCircle2, Users, TrendingUp, Award } from 'lucide-react';

interface StatItem {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description?: string;
  trend?: string;
}

const stats: StatItem[] = [
  {
    label: 'Hoteles Activos',
    value: 247,
    suffix: '+',
    icon: Building2,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    description: 'En 12 países',
    trend: '+12% vs mes anterior',
  },
  {
    label: 'Limpiezas Diarias',
    value: 12500,
    suffix: '+',
    icon: Sparkles,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    description: 'Procesadas en tiempo real',
    trend: '+8% vs semana anterior',
  },
  {
    label: 'Tiempo Promedio',
    value: 28,
    suffix: ' min',
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    description: 'Por habitación estándar',
    trend: '-3 min optimizado',
  },
  {
    label: 'Cumplimiento SLA',
    value: 94.2,
    suffix: '%',
    icon: CheckCircle2,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
    description: 'En tiempo límite configurado',
    trend: '+2.1% este trimestre',
  },
  {
    label: 'Personal Activo',
    value: 3420,
    suffix: '+',
    icon: Users,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
    description: 'Camareras y recepcionistas',
    trend: '+245 nuevos usuarios',
  },
  {
    label: 'Uptime Plataforma',
    value: 99.9,
    suffix: '%',
    icon: Award,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500/10 dark:bg-rose-950/30',
    description: 'Disponibilidad garantizada',
    trend: 'SLA 99.9% cumplido',
  },
];

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

interface AnimatedCounterProps {
  stat: StatItem;
  isVisible: boolean;
  index: number;
}

function AnimatedCounter({ stat, isVisible, index }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || hasAnimated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true);
          const duration = 2000;
          const startTime = Date.now();
          const startValue = 0;
          const endValue = stat.value;

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Easing function: easeOutExpo
            const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const currentValue = startValue + (endValue - startValue) * easedProgress;
            setCount(currentValue);

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.3, rootMargin: '0px 0px -100px 0px' }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible, hasAnimated, stat.value]);

  const displayValue = hasAnimated ? formatNumber(Math.floor(count)) : '0';

  return (
    <div
      ref={elementRef}
      className={`relative p-6 rounded-2xl border ${stat.bgColor} border-slate-200/60 dark:border-slate-800/60 transition-all duration-500 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${stat.bgColor} ${stat.color}`}>
        <stat.icon className="w-6 h-6" aria-hidden="true" />
      </div>

      {/* Counter */}
      <div className="mb-2">
        <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums">
          {stat.prefix || ''}{displayValue}{stat.suffix || ''}
        </span>
      </div>

      {/* Label */}
      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{stat.label}</div>

      {/* Description */}
      {stat.description && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">{stat.description}</div>
      )}

      {/* Trend */}
      {stat.trend && (
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <TrendingUp className="w-3 h-3" />
          <span>{stat.trend}</span>
        </div>
      )}
    </div>
  );
}

interface StatsCounterProps {
  isVisible: boolean;
}

export function StatsCounter({ isVisible }: StatsCounterProps) {
  return (
    <section id="metrics" className="py-20 bg-slate-50 dark:bg-[#0b0f19]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Métricas de la Plataforma
          </h2>
          <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Números que respaldan nuestra promesa
          </p>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Datos agregados en tiempo real de nuestra red global de hoteles. Actualizados cada minuto.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6">
          {stats.map((stat, index) => (
            <AnimatedCounter key={stat.label} stat={stat} isVisible={isVisible} index={index} />
          ))}
        </div>

        {/* Live Indicator */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Actualización en tiempo real cada 30 segundos
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}