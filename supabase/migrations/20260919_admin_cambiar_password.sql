-- ============================================================
-- AppHR - Función de Base de Datos para Cambio de Contraseña por Admin
-- Ejecutar en el SQL Editor de Supabase (Dashboard -> SQL)
-- Permite cambiar la contraseña de un usuario directamente desde Postgres
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION admin_cambiar_password(p_user_id UUID, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Verificar que el usuario que ejecuta la función tenga rol de 'admin'
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado: solo administradores pueden cambiar contraseñas');
  END IF;

  -- 2. Validar que la nueva contraseña cumpla el mínimo de 6 caracteres
  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La contraseña debe tener al menos 6 caracteres');
  END IF;

  -- 3. Actualizar la contraseña encriptada en la tabla auth.users
  UPDATE auth.users
  SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Contraseña actualizada correctamente');
END;
$$;

-- Permitir la ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION admin_cambiar_password(UUID, TEXT) TO authenticated;
