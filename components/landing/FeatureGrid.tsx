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
}

const features = [
  {
    icon: Sparkles,
    title: 'Sincronización en Tiempo Real',
    description: 'Actualizaciones instantáneas en todos los dispositivos sin recargar. La información fluye al segundo entre recepción, camareras y gerencia.',
    color: 'from-indigo-500 to-violet-500',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    borderColor: 'border-indigo-500/20 dark:border-indigo-500/30',
    highlights: ['Actualizaciones instantáneas', 'Sin demoras ni llamadas de radio', 'Reconexión automática', 'Funciona fluido'],
  },
  {
    icon: ShieldCheck,
    title: 'Seguridad y Privacidad por Hotel',
    description: 'Cada establecimiento cuenta con su entorno completamente aislado y protegido. La información de tu hotel es estrictamente privada.',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-500/20 dark:border-emerald-500/30',
    highlights: ['Aislamiento total por hotel', 'Datos encriptados', 'Permisos por rol (Recepción/Limpieza/Admin)', 'Historial de actividad'],
  },
  {
    icon: Zap,
    title: 'Panel Táctil para Camareras',
    description: 'Interfaz diseñada para el personal de limpieza. Botones grandes, cronómetro visible de estado de habitaciones y alertas de tiempo.',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
    borderColor: 'border-amber-500/20 dark:border-amber-500/30',
    highlights: ['Botones táctiles grandes', 'Cronómetro visual de limpieza', 'Alertas de tiempo límite', 'Fácil de usar sin curva de aprendizaje'],
  },
  {
    icon: BarChart3,
    title: 'Métricas Gerenciales en Vivo',
    description: 'Indicadores clave al instante: tiempos promedio de limpieza, cumplimiento de objetivos y rendimiento del personal por turnos.',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-500/10 dark:bg-violet-950/30',
    borderColor: 'border-violet-500/20 dark:border-violet-500/30',
    highlights: ['Información en tiempo real', 'Filtro por personal y zonas', 'Reportes exportables', 'Control gerencial absoluto'],
  },
  {
    icon: Wifi,
    title: 'Automatización Check-out → Limpieza',
    description: 'Flujos automáticos: al registrar la salida de un huésped, la habitación pasa a estado de limpieza y se asigna al personal disponible.',
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
    borderColor: 'border-cyan-500/20 dark:border-cyan-500/30',
    highlights: ['Avisos automáticos en cadena', 'Asignación rápida de tareas', 'Cero tiempos muertos', 'Trazabilidad completa'],
  },
  {
    icon: Users,
    title: 'Gestión de Equipos y Roles',
    description: 'Organiza los permisos de tu equipo según su cargo (Recepción, Limpieza, Mantenimiento y Dirección) con accesos seguros.',
    color: 'from-rose-500 to-pink-500',
    bgColor: 'bg-rose-500/10 dark:bg-rose-950/30',
    borderColor: 'border-rose-500/20 dark:border-rose-500/30',
    highlights: ['Roles definidos por puesto', 'Invitaciones sencillas', 'Control de accesos', 'Seguridad en cada sesión'],
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
      <div
        className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
        style={{
          background: `linear-gradient(135deg, ${feature.color.replace('from-', '').replace('to-', '')})`,
          filter: 'blur(8px)',
        }}
        aria-hidden="true"
      />

      <div
        className={`relative w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 ${feature.bgColor} text-indigo-600 dark:text-indigo-400`}
      >
        <feature.icon className="w-6 h-6" aria-hidden="true" />
        <div className="absolute inset-0 rounded-xl border-2 border-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">{feature.description}</p>

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
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Capacidades por Rol
          </h2>
          <p className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Diseñado para cada integrante de tu operación
          </p>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Cada perfil cuenta con una interfaz enfocada y herramientas optimizadas para su labor diaria en el hotel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} isVisible={isVisible} />
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Smartphone,
              title: 'Aplicación Móvil',
              desc: 'Instalable en teléfonos y tablets, con notificaciones y funcionamiento fluido para todo el equipo.',
            },
            {
              icon: Database,
              title: 'Gestión Confiable',
              desc: 'Registros seguros, respaldados y sincronizados de manera automática en todo momento.',
            },
            {
              icon: Bell,
              title: 'Avisos Inteligentes',
              desc: 'Alertas en tiempo real adaptadas a las prioridades y necesidades de cada área del hotel.',
            },
            {
              icon: Target,
              title: 'Estándares de Servicio',
              desc: 'Control de tiempos por tipo de habitación para mantener la máxima eficiencia operativa.',
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