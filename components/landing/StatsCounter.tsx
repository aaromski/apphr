'use client';

import { useEffect, useRef } from 'react';
import { Database, Wifi, Zap, Globe, Server } from 'lucide-react';

interface StatItem {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description?: string;
  category: 'operación' | 'rendimiento' | 'seguridad';
}

const stats: StatItem[] = [
  {
    label: 'Plataforma Operativa',
    value: 'Disponibilidad 24/7',
    icon: Globe,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    description: 'Sistema siempre activo sin interrupciones.',
    category: 'rendimiento',
  },
  {
    label: 'Privacidad de Datos',
    value: 'Aislamiento Independiente',
    icon: Database,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    description: 'Los datos de tu hotel protegidos de forma exclusiva.',
    category: 'seguridad',
  },
  {
    label: 'Tiempos de Respuesta',
    value: 'Actualización < 2s',
    icon: Wifi,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
    description: 'Sincronización instantánea entre áreas.',
    category: 'operación',
  },
  {
    label: 'Infraestructura Global',
    value: 'Acceso en la Nube',
    icon: Server,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
    description: 'Conexión rápida desde cualquier dispositivo.',
    category: 'rendimiento',
  },
  {
    label: 'Automatización',
    value: 'Flujos en Cadena',
    icon: Zap,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    description: 'Avisos automáticos de salida y limpieza.',
    category: 'operación',
  },
  {
    label: 'Aplicación Móvil',
    value: 'Multiplataforma',
    icon: Globe,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    description: 'Instalable en teléfonos y tablets del personal.',
    category: 'operación',
  },
];

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
        <span className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight">
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
            Capacidades que Impulsan tu Hotel
          </h2>
          <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Tecnología confiable para una operación sin fricciones
          </p>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Herramientas diseñadas para acelerar el trabajo diario de tu equipo y mejorar la experiencia de tus huéspedes.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6">
          {stats.map((stat, index) => (
            <AnimatedCounter key={stat.label} stat={stat} isVisible={isVisible} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default StatsCounter;