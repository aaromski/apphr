-- ============================================================
-- AppHR - Sistema de control de tiempos, alertas SLA y métricas
-- Ejecutar en el SQL Editor de Supabase (Dashboard -> SQL)
-- ============================================================

-- 1) Configuración de tiempos estándar y SLA por tipo de habitación
CREATE TABLE IF NOT EXISTS room_type_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_type text NOT NULL,
  tiempo_estandar_min integer NOT NULL DEFAULT 30,
  sla_min integer NOT NULL DEFAULT 45,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, room_type)
);

ALTER TABLE room_type_config ENABLE ROW LEVEL SECURITY;

-- Política: los usuarios autenticados del mismo hotel pueden leer la configuración
DROP POLICY IF EXISTS room_type_config_select_policy ON room_type_config;
CREATE POLICY room_type_config_select_policy
  ON room_type_config
  FOR SELECT
  USING (
    hotel_id IN (
      SELECT hotel_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 2) Columna de inicio de limpieza en habitaciones
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS cleaning_started_at timestamptz;

-- 3) Columnas de métricas en el historial de estados
ALTER TABLE historial_estados_habitacion
  ADD COLUMN IF NOT EXISTS duracion_min integer;

ALTER TABLE historial_estados_habitacion
  ADD COLUMN IF NOT EXISTS cumplio_sla boolean;

-- 4) Índice para acelerar las consultas analíticas
CREATE INDEX IF NOT EXISTS idx_historial_fecha_cambio
  ON historial_estados_habitacion (fecha_cambio DESC);

CREATE INDEX IF NOT EXISTS idx_historial_habitacion
  ON historial_estados_habitacion (habitacion_id);

CREATE INDEX IF NOT EXISTS idx_historial_usuario
  ON historial_estados_habitacion (usuario_id);

-- 5) Funciones auxiliares opcionales -------------------------

-- Devuelve la configuración SLA de un tipo de habitación (crea el registro por defecto si no existe)
CREATE OR REPLACE FUNCTION get_room_type_config(p_hotel_id uuid, p_room_type text)
RETURNS room_type_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg room_type_config;
BEGIN
  SELECT * INTO v_cfg
  FROM room_type_config
  WHERE hotel_id = p_hotel_id AND room_type = p_room_type
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO room_type_config (hotel_id, room_type)
    VALUES (p_hotel_id, p_room_type)
    ON CONFLICT (hotel_id, room_type) DO NOTHING;

    SELECT * INTO v_cfg
    FROM room_type_config
    WHERE hotel_id = p_hotel_id AND room_type = p_room_type
    LIMIT 1;
  END IF;

  RETURN v_cfg;
END;
$$;

-- ============================================================
-- DATOS SEMILLA (opcional): registra la configuración por defecto
-- para los tipos que ya existan en la tabla rooms del hotel.
-- Ajusta p_hotel si tu hotel ya tiene un ID en la tabla hotels.
-- ============================================================
DO $$
DECLARE
  v_hotel_id uuid;
  v_tipo text;
BEGIN
  FOR v_hotel_id IN SELECT id FROM hotels LOOP
    FOR v_tipo IN
      SELECT DISTINCT room_type FROM rooms WHERE hotel_id = v_hotel_id AND room_type IS NOT NULL
    LOOP
      INSERT INTO room_type_config (hotel_id, room_type)
      VALUES (v_hotel_id, v_tipo)
      ON CONFLICT (hotel_id, room_type) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;