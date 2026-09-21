'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Sparkles, Clock, CheckCircle2, Users, TrendingUp, Award, Database, Wifi, Zap, Shield, Globe, Server, Cpu } from 'lucide-react';

interface StatItem {
  label: string;
  value: string;
  suffix?: string;
  prefix?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description?: string;
  category: 'technical' | 'capability' | 'architecture';
}

const stats: StatItem[] = [
  {
    label: 'Arquitectura',
    value: 'Jamstack/Serverless',
    icon: Globe,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    description: 'Next.js 16 App Router + Supabase Edge',
    category: 'architecture',
  },
  {
    label: 'Base de Datos',
    value: 'PostgreSQL + RLS',
    icon: Database,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    description: 'Row Level Security nativo por hotel_id',
    category: 'architecture',
  },
  {
    label: 'Tiempo Real',
    value: 'Supabase Realtime',
    icon: Wifi,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
    description: 'WebSockets nativos, latencia < 2s',
    category: 'technical',
  },
  {
    label: 'Edge Runtime',
    value: 'Supabase Edge (Deno)',
    icon: Server,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
    description: 'Edge Functions para webhooks y automatización',
    category: 'technical',
  },
  {
    label: 'Automatización',
    value: 'n8n / Power Automate',
    icon: Zap,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    description: 'Webhooks HTTP con HMAC + reintentos',
    category: 'capability',
  },
  {
    label: 'Mobile PWA',
    value: 'PWA Instalable',
    icon: Globe,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    description: 'PWA instalable, offline-first, push notifications',
    category: 'capability',
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
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.3, rootMargin: '0px 0px -100px 0px' }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={elementRef}
      className={`relative p-6 rounded-2xl border ${stat.bgColor} border-slate-200/60 dark:border-slate-800/60 transition-all duration-500 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} transition-all duration-700 ease-out`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Category Badge */}
      <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        <span>{stat.category.toUpperCase()}</span>
      </div>

      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${stat.bgColor} ${stat.color}`}>
        <stat.icon className="w-6 h-6" aria-hidden="true" />
      </div>

      {/* Value */}
      <div className="mb-2">
        <span className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight break-words">
          {stat.value}
        </span>
      </div>

      {/* Label */}
      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{stat.label}</div>

      {/* Description */}
      {stat.description && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">{stat.description}</div>
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
            Capacidades Técnicas Reales
          </h2>
          <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Arquitectura moderna sin métricas infladas
          </p>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Solo capacidades técnicas reales y verificables. Sin métricas infladas ni clientes ficticios.
            La arquitectura habla por sí misma.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6">
          {stats.map((stat, index) => (
            <AnimatedCounter key={stat.label} stat={stat} isVisible={isVisible} index={index} />
          ))}
        </div>

        {/* Technical Stack Summary */}
        <div className="mt-16">
          <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-8 sm:p-12 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
              Stack Tecnológico Verificable
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="px-3 py-1 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">Next.js 16 (App Router)</span>
              <span className="px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">PostgreSQL + RLS</span>
              <span className="px-3 py-1 rounded-full bg-violet-600/20 text-violet-400 border border-violet-500/30">Supabase Realtime</span>
              <span className="px-3 py-1 rounded-full bg-amber-600/20 text-amber-400 border border-amber-500/30">n8n / Edge Functions</span>
              <span className="px-3 py-1 rounded-full bg-rose-600/20 text-rose-400 border border-rose-500/30">PWA + Service Worker</span>
              <span className="px-3 py-1 rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">TypeScript Strict</span>
            </div>
            <p className="mt-6 text-sm text-slate-400 max-w-2xl mx-auto">
              Sin vendor lock-in · Desplegable en Vercel, Docker o Kubernetes · Código abierto y auditable
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StatsCounter;