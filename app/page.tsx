'use client';

import { ThemeProvider } from '@/components/landing';
import { Navbar, HeroSection, FeatureGrid, StatsCounter, Footer } from '@/components/landing';

export default function WelcomePage() {
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target.id === 'features') setFeaturesVisible(true);
            if (entry.target.id === 'metrics') setStatsVisible(true);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
    );

    const featuresEl = document.getElementById('features');
    const statsEl = document.getElementById('metrics');

    if (featuresEl) observer.observe(featuresEl);
    if (statsEl) observer.observe(statsEl);

    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-200 flex flex-col font-sans transition-colors duration-300 relative overflow-hidden">
        {/* Navbar */}
        <Navbar />

        {/* Main Content */}
        <main className="flex-1">
          {/* Hero Section */}
          <HeroSection />

          {/* Feature Grid */}
          <FeatureGrid isVisible={featuresVisible} />

          {/* Stats Counter */}
          <StatsCounter isVisible={statsVisible} />

         

          {/* CTA Banner */}
          <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-900/90 dark:to-[#111625] rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true" />

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                ¿Listo para llevar la gestión de tu hotel al siguiente nivel?
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-indigo-100 max-w-xl mx-auto leading-relaxed">
                Registra tu hotel en pocos segundos, obtén tu código de inquilino exclusivo y comienza a optimizar los tiempos
                de asignación y limpieza.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="/registro"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg active:scale-[0.98] transition-all"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Registrar Hotel Ahora</span>
                </a>

                <a
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-indigo-700/50 hover:bg-indigo-700 text-white border border-indigo-400/30 active:scale-[0.98] transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Ya tengo cuenta</span>
                </a>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </ThemeProvider>
  );
}

// Import React hooks and icons needed in this file
import { useState, useEffect } from 'react';
import { Building2, LogIn } from 'lucide-react';