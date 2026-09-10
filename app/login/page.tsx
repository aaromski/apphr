'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Building2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const [hotelCode, setHotelCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Autenticación con Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg('Credenciales inválidas o código de hotel incorrecto.');
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Botón flotante para cambiar de tema */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Fondo sutil con brillo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Contenedor Principal */}
      <div className="w-full max-w-[420px] bg-white/90 dark:bg-[#111625]/90 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 transition-colors duration-300">
        
        {/* Isotipo / Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-1.5">
            AppHR
          </h1>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-2">Iniciar Sesión en AppHR</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Accede a tu panel de gestión hotelera</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 p-3 rounded-xl mb-5 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Campo: Código del Hotel */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Código del Hotel</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={hotelCode}
                onChange={(e) => setHotelCode(e.target.value)}
                placeholder="Ej: HOTEL-2024"
                className="w-full bg-slate-50 dark:bg-[#0b0f19]/80 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Campo: Correo Electrónico */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@hotel.com"
                className="w-full bg-slate-50 dark:bg-[#0b0f19]/80 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Campo: Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-[#0b0f19]/80 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-10 pr-10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Opciones: Recordarme y Olvidaste */}
          <div className="flex items-center justify-between pt-1 pb-2 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer group select-none">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                {/* Caja personalizada estilizada */}
                <div className="w-4 h-4 rounded-md bg-slate-100 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700/80 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 group-hover:border-slate-400 dark:group-hover:border-slate-500 transition-all flex items-center justify-center shadow-sm">
                  <svg
                    className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <span className="text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                Recordarme
              </span>
            </label>

            <a
              href="#"
              suppressHydrationWarning
              className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {/* Botón Iniciar Sesión */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Banner Inferior de Seguridad */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col items-center justify-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Protegido con encriptación de 256 bits</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            VERIFICACIÓN DE SEGURIDAD ACTIVA
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-[11px] text-slate-500 flex gap-6">
        <span>© 2026 AppHR Technologies</span>
        <a href="#" className="hover:text-slate-700 dark:hover:text-slate-400">Soporte</a>
        <a href="#" className="hover:text-slate-700 dark:hover:text-slate-400">Privacidad</a>
      </footer>
    </main>
  );
}