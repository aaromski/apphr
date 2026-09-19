-- ============================================================
-- AppHR - Bitácora automática (Trigger) + Regla de Negocio RN-01
-- Ejecutar en el SQL Editor de Supabase (Dashboard -> SQL)
-- ============================================================

-- 0) Permitir a los usuarios del hotel escribir su configuración de tiempos (RF-05)
DROP POLICY IF EXISTS room_type_config_insert_policy ON room_type_config;
CREATE POLICY room_type_config_insert_policy
  ON room_type_config FOR INSERT
  TO authenticated
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS room_type_config_update_policy ON room_type_config;
CREATE POLICY room_type_config_update_policy
  ON room_type_config FOR UPDATE
  TO authenticated
  USING (hotel_id IN (SELECT hotel_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (hotel_id IN (SELECT hotel_id FROM profiles WHERE id = auth.uid()));

-- 1) RN-01: una habitación no puede pasar a "Disponible" sin completar el ciclo
--    Ocupada -> Check-Out -> Limpia/Lista.
CREATE OR REPLACE FUNCTION public.fn_rooms_validar_transicion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'Disponible'
     AND OLD.status NOT IN ('Limpia/Lista', 'Disponible', 'Mantenimiento') THEN
    RAISE EXCEPTION
      'RN-01: la habitación % debe pasar por Check-Out y Limpia/Lista antes de estar Disponible (estado actual: %)',
      OLD.room_number, OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_validar_transicion ON public.rooms;
CREATE TRIGGER trg_rooms_validar_transicion
BEFORE UPDATE OF status ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.fn_rooms_validar_transicion();

-- 2) Bitácora automática: registra cada transición de estado en el historial,
--    calculando duración real y cumplimiento de SLA al finalizar la limpieza.
CREATE OR REPLACE FUNCTION public.fn_rooms_log_historial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duracion integer;
  v_cumplio  boolean;
  v_sla      integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

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
    (NEW.hotel_id, NEW.id, auth.uid(), OLD.status, NEW.status, now(), v_duracion, v_cumplio);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_log_historial ON public.rooms;
CREATE TRIGGER trg_rooms_log_historial
AFTER UPDATE OF status ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.fn_rooms_log_historial();
