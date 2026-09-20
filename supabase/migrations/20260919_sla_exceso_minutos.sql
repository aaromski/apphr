-- ============================================================
-- AppHR - Agregar tracking de minutos excedidos (SLA breach) en métricas
-- ============================================================

-- 1) Agregar columna para acumular minutos totales excedidos del SLA
ALTER TABLE public.metricas_limpieza_detalle
ADD COLUMN IF NOT EXISTS suma_exceso_min integer NOT NULL DEFAULT 0;

-- 2) Actualizar el trigger para calcular y acumular minutos excedidos
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
  v_exceso          integer;
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
    -- Calcular minutos excedidos (0 si cumplió, diferencia si no)
    v_exceso := CASE WHEN v_cumplio THEN 0 ELSE v_duracion - COALESCE(v_sla, 45) END;
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
  INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, suma_exceso_min, updated_at)
  VALUES (NEW.hotel_id, 'tipo', COALESCE(NEW.room_type, 'Estándar'), COALESCE(NEW.room_type, 'Estándar'), 1, v_duracion, v_cum, v_exceso, now())
  ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
    limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
    suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion,
    cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
    suma_exceso_min   = metricas_limpieza_detalle.suma_exceso_min + v_exceso,
    updated_at        = now();

  -- 7.3 Desglose por zona / piso
  INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, suma_exceso_min, updated_at)
  VALUES (NEW.hotel_id, 'zona', COALESCE(NEW.zone, 'Sin zona'), COALESCE(NEW.zone, 'Sin zona'), 1, v_duracion, v_cum, v_exceso, now())
  ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
    limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
    suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion,
    cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
    suma_exceso_min   = metricas_limpieza_detalle.suma_exceso_min + v_exceso,
    updated_at        = now();

  -- 7.4 Desglose por personal de limpieza
  SELECT nombre INTO v_personal_nombre FROM profiles WHERE id = v_uid;
  INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, suma_exceso_min, updated_at)
  VALUES (NEW.hotel_id, 'personal', v_uid::text, COALESCE(v_personal_nombre, 'Personal'), 1, v_duracion, v_cum, v_exceso, now())
  ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
    limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
    suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion,
    cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
    suma_exceso_min   = metricas_limpieza_detalle.suma_exceso_min + v_exceso,
    updated_at        = now();

  RETURN NEW;
END;
$$;

-- 3) Backfill inicial para datos existentes: calcular exceso desde historial
UPDATE metricas_limpieza_detalle md
SET suma_exceso_min = COALESCE((
  SELECT SUM(CASE 
    WHEN h.duracion_min > COALESCE(rtc.sla_min, 45) 
    THEN h.duracion_min - COALESCE(rtc.sla_min, 45)
    ELSE 0 END)
  FROM historial_estados_habitacion h
  LEFT JOIN rooms r ON r.id = h.habitacion_id
  LEFT JOIN room_type_config rtc ON rtc.hotel_id = h.hotel_id AND rtc.room_type = COALESCE(r.room_type, 'Estándar')
  WHERE h.estado_nuevo = 'Limpia/Lista'
    AND h.duracion_min IS NOT NULL
    AND h.hotel_id = md.hotel_id
    AND (
      (md.dimension = 'tipo' AND COALESCE(r.room_type, 'Estándar') = md.clave)
      OR (md.dimension = 'zona' AND COALESCE(r.zone, 'Sin zona') = md.clave)
      OR (md.dimension = 'personal' AND h.usuario_id::text = md.clave)
    )
), 0)
WHERE md.suma_exceso_min = 0;