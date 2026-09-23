-- ============================================================
-- AppHR - Políticas de Registro de Nuevos Hoteles y Administradores
-- Ejecutar en el SQL Editor de Supabase (Dashboard -> SQL)
-- ============================================================

-- 1. Habilitar RLS en la tabla hotels (si aún no estuviera habilitado)
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

-- 2. Permitir que usuarios anónimos o autenticados puedan registrar un nuevo hotel
DROP POLICY IF EXISTS "Permitir crear hotel en registro" ON public.hotels;
CREATE POLICY "Permitir crear hotel en registro"
  ON public.hotels
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 3. Permitir la lectura de hoteles por código o por inquilino asociado
DROP POLICY IF EXISTS "Permitir leer hoteles" ON public.hotels;
CREATE POLICY "Permitir leer hoteles"
  ON public.hotels
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Políticas para la tabla profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Permitir la inserción de perfiles para el usuario autenticado
DROP POLICY IF EXISTS "Permitir inserción de perfil propio" ON public.profiles;
CREATE POLICY "Permitir inserción de perfil propio"
  ON public.profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (auth.uid() = id);

-- Permitir actualizar su propio perfil
DROP POLICY IF EXISTS "Permitir actualizar propio perfil" ON public.profiles;
CREATE POLICY "Permitir actualizar propio perfil"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
