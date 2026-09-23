-- ============================================================
-- AppHR - Métricas en tiempo real para el Dashboard Gerencial
-- Tablas resumen precomputadas + actualización incremental por trigger
-- Ejecutar después de 20260917_historial_trigger_rn01.sql
-- ============================================================

-- 1) Resumen por hotel (KPIs: promedio, SLAs)
CREATE TABLE IF NOT EXISTS public.metricas_limpieza (
  hotel_id           uuid PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  total_limpiezas    integer NOT NULL DEFAULT 0,
  suma_duracion_min  integer NOT NULL DEFAULT 0,
  sla_cumplidas      integer NOT NULL DEFAULT 0,
  sla_retrasadas     integer NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- 2) Desglose por dimensión (tipo / zona / personal) para los gráficos
CREATE TABLE IF NOT EXISTS public.metricas_limpieza_detalle (
  hotel_id           uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  dimension          text NOT NULL CHECK (dimension IN ('tipo', 'zona', 'personal')),
  clave              text NOT NULL,
  nombre             text,
  limpiezas          integer NOT NULL DEFAULT 0,
  suma_duracion_min  integer NOT NULL DEFAULT 0,
  cumplidas          integer NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, dimension, clave)
);

-- 3) RLS: solo usuarios del mismo hotel pueden leer sus métricas
ALTER TABLE public.metricas_limpieza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricas_limpieza_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS metricas_limpieza_select ON public.metricas_limpieza;
CREATE POLICY metricas_limpieza_select
  ON public.metricas_limpieza FOR SELECT
  TO authenticated
  USING (hotel_id IN (SELECT hotel_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS metricas_limpieza_detalle_select ON public.metricas_limpieza_detalle;
CREATE POLICY metricas_limpieza_detalle_select
  ON public.metricas_limpieza_detalle FOR SELECT
  TO authenticated
  USING (hotel_id IN (SELECT hotel_id FROM profiles WHERE id = auth.uid()));

-- 4) Los triggers los escribe el SECURITY DEFINER (postgres), sin políticas de escritura.

-- 5) Realtime: imagen completa para que el filtro hotel_id funcione en UPDATE/DELETE
ALTER TABLE public.metricas_limpieza REPLICA IDENTITY FULL;
ALTER TABLE public.metricas_limpieza_detalle REPLICA IDENTITY FULL;

-- 6) Suscribir las tablas a la publicación realtime (idempotente)
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['metricas_limpieza', 'metricas_limpieza_detalle'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- 7) Trigger: tras registrar el historial, actualiza O(1) las métricas del hotel
CREATE OR REPLACE FUNCTION public.fn_rooms_log_historial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duracion        integer;
  v_cumplio         boolean;
  v_sla             integer;
  v_uid             uuid;
  v_personal_nombre text;
  v_cum             integer;
  v_retrasada       integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();

  IF OLD.status = 'En Limpieza'
     AND NEW.status = 'Limpia/Lista'
     AND OLD.cleaning_started_at IS NOT NULL THEN
    v_duracion := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - OLD.cleaning_started_at)) / 60)::integer);

    SELECT sla_min INTO v_sla
    FROM room_type_config
    WHERE hotel_id = NEW.hotel_id
      AND room_type = COALESCE(NEW.room_type, 'Estándar')
    LIMIT 1;

    v_cumplio := v_duracion <= COALESCE(v_sla, 45);
  END IF;

  INSERT INTO historial_estados_habitacion
    (hotel_id, habitacion_id, usuario_id, estado_anterior, estado_nuevo, fecha_cambio, duracion_min, cumplio_sla)
  VALUES
    (NEW.hotel_id, NEW.id, v_uid, OLD.status, NEW.status, now(), v_duracion, v_cumplio);

  -- Solo las limpiezas completadas alimentan las métricas
  IF v_duracion IS NULL THEN
    RETURN NEW;
  END IF;

  v_cum := CASE WHEN v_cumplio THEN 1 ELSE 0 END;
  v_retrasada := CASE WHEN v_cumplio THEN 0 ELSE 1 END;

  -- 7.1 Resumen del hotel
  INSERT INTO metricas_limpieza (hotel_id, total_limpiezas, suma_duracion_min, sla_cumplidas, sla_retrasadas, updated_at)
  VALUES (NEW.hotel_id, 1, v_duracion, v_cum, v_retrasada, now())
  ON CONFLICT (hotel_id) DO UPDATE SET
    total_limpiezas   = metricas_limpieza.total_limpiezas + 1,
    suma_duracion_min = metricas_limpieza.suma_duracion_min + v_duracion,
    sla_cumplidas     = metricas_limpieza.sla_cumplidas + v_cum,
    sla_retrasadas    = metricas_limpieza.sla_retrasadas + v_retrasada,
    updated_at        = now();

  -- 7.2 Desglose por tipo de habitación
  INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, updated_at)
  VALUES (NEW.hotel_id, 'tipo', COALESCE(NEW.room_type, 'Estándar'), COALESCE(NEW.room_type, 'Estándar'), 1, v_duracion, v_cum, now())
  ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
    limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
    suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion,
    cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
    updated_at        = now();

  -- 7.3 Desglose por zona / piso
  INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, updated_at)
  VALUES (NEW.hotel_id, 'zona', COALESCE(NEW.zone, 'Sin zona'), COALESCE(NEW.zone, 'Sin zona'), 1, v_duracion, v_cum, now())
  ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
    limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
    suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion,
    cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
    updated_at        = now();

  -- 7.4 Desglose por personal de limpieza
  SELECT nombre INTO v_personal_nombre FROM profiles WHERE id = v_uid;
  INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, updated_at)
  VALUES (NEW.hotel_id, 'personal', v_uid::text, COALESCE(v_personal_nombre, 'Personal'), 1, v_duracion, v_cum, now())
  ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
    limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
    suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion,
    cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
    updated_at        = now();

  RETURN NEW;
END;
$$;

-- 8) Carga inicial (backfill) con el historial existente
INSERT INTO metricas_limpieza (hotel_id, total_limpiezas, suma_duracion_min, sla_cumplidas, sla_retrasadas, updated_at)
SELECT
  hotel_id,
  count(*),
  COALESCE(sum(duracion_min), 0),
  count(*) FILTER (WHERE cumplio_sla = true),
  count(*) FILTER (WHERE cumplio_sla = false),
  max(fecha_cambio)
FROM historial_estados_habitacion
WHERE estado_nuevo = 'Limpia/Lista'
  AND duracion_min IS NOT NULL
GROUP BY hotel_id
ON CONFLICT (hotel_id) DO NOTHING;

INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, updated_at)
SELECT
  h.hotel_id,
  'tipo',
  COALESCE(r.room_type, 'Estándar'),
  COALESCE(r.room_type, 'Estándar'),
  count(*),
  COALESCE(sum(h.duracion_min), 0),
  count(*) FILTER (WHERE h.cumplio_sla = true),
  max(h.fecha_cambio)
FROM historial_estados_habitacion h
LEFT JOIN rooms r ON r.id = h.habitacion_id
WHERE h.estado_nuevo = 'Limpia/Lista'
  AND h.duracion_min IS NOT NULL
GROUP BY h.hotel_id, r.room_type
ON CONFLICT (hotel_id, dimension, clave) DO NOTHING;

INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, updated_at)
SELECT
  h.hotel_id,
  'zona',
  COALESCE(r.zone, 'Sin zona'),
  COALESCE(r.zone, 'Sin zona'),
  count(*),
  COALESCE(sum(h.duracion_min), 0),
  count(*) FILTER (WHERE h.cumplio_sla = true),
  max(h.fecha_cambio)
FROM historial_estados_habitacion h
LEFT JOIN rooms r ON r.id = h.habitacion_id
WHERE h.estado_nuevo = 'Limpia/Lista'
  AND h.duracion_min IS NOT NULL
GROUP BY h.hotel_id, r.zone
ON CONFLICT (hotel_id, dimension, clave) DO NOTHING;

INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, updated_at)
SELECT
  h.hotel_id,
  'personal',
  h.usuario_id::text,
  COALESCE(p.nombre, 'Personal'),
  count(*),
  COALESCE(sum(h.duracion_min), 0),
  count(*) FILTER (WHERE h.cumplio_sla = true),
  max(h.fecha_cambio)
FROM historial_estados_habitacion h
LEFT JOIN profiles p ON p.id = h.usuario_id
WHERE h.estado_nuevo = 'Limpia/Lista'
  AND h.duracion_min IS NOT NULL
  AND h.usuario_id IS NOT NULL
GROUP BY h.hotel_id, h.usuario_id, p.nombre
ON CONFLICT (hotel_id, dimension, clave) DO NOTHING;