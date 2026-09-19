'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Mail, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, Copy, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function RegistroPage() {
  const router = useRouter();

  const [hotelName, setHotelName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  // Estado tras registro exitoso
  const [registeredInfo, setRegisteredInfo] = useState<{
    hotelName: string;
    hotelCode: string;
    email: string;
  } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validaciones
    if (hotelName.trim().length < 3) {
      setErrorMsg('El nombre del hotel debe tener al menos 3 caracteres.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Verifícalas e intenta nuevamente.');
      return;
    }

    setLoading(true);

    try {
      // 1. Generar un código único para el hotel
      // Formato: HTL + 4 caracteres alfanuméricos en mayúsculas (ej: HTL-7K2P)
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const generatedCode = `HTL-${randomSuffix}`;

      // 2. Insertar el nuevo hotel en la tabla 'hotels'
      const { data: newHotel, error: hotelError } = await supabase
        .from('hotels')
        .insert([
          {
            name: hotelName.trim(),
            code: generatedCode,
          },
        ])
        .select('id, code, name')
        .single();

      if (hotelError || !newHotel) {
        if (hotelError?.code === '42501') {
          setErrorMsg(
            'Error de permisos (RLS) en la tabla hotels. Por favor ejecuta la migración 20260919_registro_hotel.sql en el SQL Editor de Supabase.'
          );
        } else {
          setErrorMsg('Error al registrar el hotel: ' + (hotelError?.message || 'Error desconocido'));
        }
        setLoading(false);
        return;
      }

      // 3. Registrar el usuario Administrador en Supabase Auth
      // Los metadatos permiten que el trigger de Supabase cree automáticamente el perfil vinculado
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            hotel_id: newHotel.id,
            role: 'admin',
            nombre: hotelName.trim(),
            activo: true,
          },
        },
      });

      if (authError) {
        // En caso de fallo en Auth, intentar limpiar el hotel creado para no dejar registros huérfanos
        await supabase.from('hotels').delete().eq('id', newHotel.id);
        setErrorMsg('Error en el registro de autenticación: ' + authError.message);
        setLoading(false);
        return;
      }

      // 4. Asegurar la existencia o actualización del perfil en public.profiles
      if (authData.user) {
        try {
          await supabase.from('profiles').upsert({
            id: authData.user.id,
            hotel_id: newHotel.id,
            email: email.trim().toLowerCase(),
            role: 'admin',
            nombre: hotelName.trim(),
            activo: true,
          });
        } catch {
          // Si el trigger ya lo creó o hay restricción temporal, continuamos
        }
      }

      // 5. Establecer la información de éxito
      setRegisteredInfo({
        hotelName: newHotel.name,
        hotelCode: newHotel.code,
        email: email.trim().toLowerCase(),
      });
    } catch (err) {
      setErrorMsg('Ocurrió un error inesperado: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!registeredInfo?.hotelCode) return;
    try {
      await navigator.clipboard.writeText(registeredInfo.hotelCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback si el portapapeles no está disponible
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

      {/* Contenedor Principal (misma estética centrada del Login) */}
      <div className="w-full max-w-[420px] bg-white/90 dark:bg-[#111625]/90 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 transition-colors duration-300">
        {!registeredInfo ? (
          <>
            {/* Isotipo / Encabezado */}
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-1.5">
                AppHR
              </h1>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-2">Registrar Nuevo Hotel</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Crea el hotel y tu cuenta de Administrador principal
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 p-3 rounded-xl mb-5 text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Campo 1: Nombre del Hotel */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre del Hotel
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="hotelName"
                    autoComplete="organization"
                    required
                    value={hotelName}
                    onChange={(e) => setHotelName(e.target.value)}
                    placeholder="Ej: Hotel Grand Bahía"
                    className="w-full bg-slate-50 dark:bg-[#0b0f19]/80 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Campo 2: Correo Electrónico */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Correo Electrónico (Administrador)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@hotel.com"
                    className="w-full bg-slate-50 dark:bg-[#0b0f19]/80 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Campo 3: Contraseña */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-50 dark:bg-[#0b0f19]/80 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-10 pr-10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Campo 4: Confirmación de Contraseña */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full bg-slate-50 dark:bg-[#0b0f19]/80 border border-slate-300 dark:border-slate-700/80 rounded-xl py-2.5 pl-10 pr-10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Ver confirmación'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botón de Enviar */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Creando Hotel y Administrador...' : 'Registrar Hotel'}
              </button>
            </form>

            {/* Enlaces de pie de tarjeta */}
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 space-y-3 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                ¿Ya tienes cuenta?{' '}
                <Link
                  href="/login"
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline hover:text-indigo-500 transition-colors"
                >
                  Inicia sesión
                </Link>
              </p>
              <div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver a la página principal
                </Link>
              </div>
            </div>
          </>
        ) : (
          /* Pantalla de Éxito y Entrega de Código de Hotel */
          <div className="flex flex-col items-center text-center py-2 animate-fadeIn">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">¡Hotel Registrado con Éxito!</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              El hotel <strong className="text-slate-800 dark:text-slate-200">{registeredInfo.hotelName}</strong> ha
              sido dado de alta con su cuenta de Administrador.
            </p>

            {/* Tarjeta con el código generado */}
            <div className="w-full my-5 p-4 rounded-xl bg-slate-100 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 flex flex-col items-center">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tu Código de Hotel
              </span>
              <div className="text-2xl font-mono font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400 mt-1">
                {registeredInfo.hotelCode}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">¡Código Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copiar Código</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left text-[11px] text-amber-700 dark:text-amber-300/90 mb-5 leading-relaxed">
              <strong>Importante:</strong> Guarda este código. Tu equipo y tú lo necesitarán para iniciar sesión en AppHR
              junto con sus correos y contraseñas.
            </div>

            {/* Botón de acceso directo a Login con datos precargados */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/login?code=${encodeURIComponent(registeredInfo.hotelCode)}&email=${encodeURIComponent(
                    registeredInfo.email
                  )}`
                )
              }
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
            >
              <span>Ir a Iniciar Sesión</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="mt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a la página principal
              </Link>
            </div>
          </div>
        )}

        {/* Banner Inferior de Seguridad */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 flex flex-col items-center justify-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
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
        <a href="#" className="hover:text-slate-700 dark:hover:text-slate-400">
          Soporte
        </a>
        <a href="#" className="hover:text-slate-700 dark:hover:text-slate-400">
          Privacidad
        </a>
      </footer>
    </main>
  );
}
