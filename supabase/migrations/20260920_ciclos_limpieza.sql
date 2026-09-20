-- ============================================================
-- AppHR - Ciclos de Limpieza (Tabla operativa independiente)
-- Migración actualizada para coincidir con el trigger real en producción
-- ============================================================

-- 1) Limpiar columnas de métricas del historial general (solo auditoría pura)
ALTER TABLE public.historial_estados_habitacion 
DROP COLUMN IF EXISTS duracion_min,
DROP COLUMN IF EXISTS cumplio_sla;

-- 2) Tabla principal de ciclos de limpieza
CREATE TABLE IF NOT EXISTS public.ciclos_limpieza (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  habitacion_id       uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  usuario_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  estado_origen       text NOT NULL,          -- 'Ocupada', 'Check-Out', etc.
  sucia_at            timestamptz DEFAULT now(),  -- Cuándo pasó a 'Sucia'
  iniciado_at         timestamptz,            -- Cuándo pasó a 'En Limpieza'
  finalizado_at       timestamptz,            -- Cuándo completó la limpieza
  duracion_min        integer,                -- Duración real en minutos
  sla_min             integer,                -- SLA configurado al momento
  cumplio_sla         boolean,                -- true si duracion_min <= sla_min
  minutos_excedidos   integer,                -- max(0, duracion_min - sla_min)
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas analíticas rápidas
CREATE INDEX IF NOT EXISTS idx_ciclos_hotel_fecha ON public.ciclos_limpieza (hotel_id, finalizado_at DESC);
CREATE INDEX IF NOT EXISTS idx_ciclos_habitacion ON public.ciclos_limpieza (habitacion_id);
CREATE INDEX IF NOT EXISTS idx_ciclos_usuario ON public.ciclos_limpieza (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ciclos_estado ON public.ciclos_limpieza (estado_origen);

-- 3) RLS: solo usuarios del mismo hotel pueden leer sus ciclos
ALTER TABLE public.ciclos_limpieza ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ciclos_limpieza_select ON public.ciclos_limpieza;
CREATE POLICY ciclos_limpieza_select
  ON public.ciclos_limpieza FOR SELECT
  TO authenticated
  USING (hotel_id IN (SELECT hotel_id FROM profiles WHERE id = auth.uid()));

-- Insert/Update lo hace el trigger SECURITY DEFINER (postgres), no el usuario.

-- 4) Realtime: imagen completa para que el filtro hotel_id funcione en UPDATE/DELETE
ALTER TABLE public.ciclos_limpieza REPLICA IDENTITY FULL;

-- 5) Suscribir la tabla a la publicación realtime (idempotente)
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ciclos_limpieza'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', 'ciclos_limpieza');
    END IF;
  END IF;
END $$;

-- 6) Función helper: obtener ciclos completados con filtros opcionales
CREATE OR REPLACE FUNCTION public.get_ciclos_limpieza(
  p_hotel_id  uuid,
  p_desde     timestamptz DEFAULT NULL,
  p_hasta     timestamptz DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL,
  p_zona      text DEFAULT NULL,
  p_room_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  habitacion_id uuid,
  room_number text,
  room_type text,
  zone text,
  usuario_id uuid,
  personal_nombre text,
  estado_origen text,
  sucia_at timestamptz,
  iniciado_at timestamptz,
  finalizado_at timestamptz,
  duracion_min integer,
  sla_min integer,
  cumplio_sla boolean,
  minutos_excedidos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.habitacion_id,
    r.room_number,
    r.room_type,
    r.zone,
    c.usuario_id,
    p.nombre AS personal_nombre,
    c.estado_origen,
    c.sucia_at,
    c.iniciado_at,
    c.finalizado_at,
    c.duracion_min,
    c.sla_min,
    c.cumplio_sla,
    c.minutos_excedidos
  FROM public.ciclos_limpieza c
  JOIN public.rooms r ON r.id = c.habitacion_id
  LEFT JOIN public.profiles p ON p.id = c.usuario_id
  WHERE c.hotel_id = p_hotel_id
    AND c.finalizado_at IS NOT NULL
    AND (p_desde IS NULL OR c.finalizado_at >= p_desde)
    AND (p_hasta IS NULL OR c.finalizado_at <= p_hasta)
    AND (p_usuario_id IS NULL OR c.usuario_id = p_usuario_id)
    AND (p_zona IS NULL OR r.zone = p_zona)
    AND (p_room_type IS NULL OR r.room_type = p_room_type)
  ORDER BY c.finalizado_at DESC;
END;
$$;

-- 7) Backfill inicial: poblar ciclos_limpieza desde historial_estados_habitacion existente
--    (Solo para habitaciones que ya completaron el ciclo Sucia -> En Limpieza -> Limpia/Lista)
INSERT INTO public.ciclos_limpieza (
  hotel_id, habitacion_id, usuario_id, estado_origen,
  sucia_at, iniciado_at, finalizado_at, duracion_min, sla_min, cumplio_sla, minutos_excedidos,
  created_at
)
SELECT
  h.hotel_id,
  h.habitacion_id,
  h.usuario_id,
  h.estado_anterior,
  (
    SELECT fecha_cambio FROM historial_estados_habitacion h2
    WHERE h2.habitacion_id = h.habitacion_id
      AND h2.estado_nuevo = 'Sucia'
      AND h2.fecha_cambio < h.fecha_cambio
    ORDER BY h2.fecha_cambio DESC LIMIT 1
  ) AS sucia_at,
  (
    SELECT fecha_cambio FROM historial_estados_habitacion h3
    WHERE h3.habitacion_id = h.habitacion_id
      AND h3.estado_nuevo = 'En Limpieza'
      AND h3.fecha_cambio < h.fecha_cambio
    ORDER BY h3.fecha_cambio DESC LIMIT 1
  ) AS iniciado_at,
  h.fecha_cambio AS finalizado_at,
  h.duracion_min,
  COALESCE((
    SELECT sla_min FROM room_type_config rtc
    JOIN rooms r ON r.id = h.habitacion_id
    WHERE rtc.hotel_id = h.hotel_id AND rtc.room_type = COALESCE(r.room_type, 'Estándar')
    LIMIT 1
  ), 45) AS sla_min,
  h.cumplio_sla,
  CASE WHEN h.cumplio_sla THEN 0 ELSE COALESCE(h.duracion_min, 0) - COALESCE((
    SELECT sla_min FROM room_type_config rtc
    JOIN rooms r ON r.id = h.habitacion_id
    WHERE rtc.hotel_id = h.hotel_id AND rtc.room_type = COALESCE(r.room_type, 'Estándar')
    LIMIT 1
  ), 45) END AS minutos_excedidos,
  h.fecha_cambio
FROM historial_estados_habitacion h
WHERE h.estado_nuevo = 'Limpia/Lista'
  AND h.duracion_min IS NOT NULL
  AND h.cumplio_sla IS NOT NULL
ON CONFLICT DO NOTHING;

-- 8) NOTA: El trigger principal fn_gestion_completa_habitacion() se ejecuta 
--    como BEFORE UPDATE en la tabla rooms y gestiona todo el flujo:
--    - 'Sucia': crea ciclo con estado_origen y sucia_at
--    - 'En Limpieza': actualiza iniciado_at y usuario_id
--    - 'Limpia/Lista'/'Disponible'/'Ocupada': calcula duración, SLA, cumplimiento,
--      actualiza ciclos_limpieza, alimenta metricas_limpieza/_detalle,
--      y auto-determina status final (Disponible si venía de Ocupada/Check-Out, sino Ocupada)
--    El trigger existe en la BD y no se replica aquí para evitar duplicados.