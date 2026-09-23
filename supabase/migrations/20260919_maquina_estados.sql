-- ============================================================
-- AppHR - Máquina de estados de habitaciones (RN-01 v2)
-- Ejecutar en el SQL Editor de Supabase (Dashboard -> SQL)
-- Después de: 20260917_historial_trigger_rn01.sql y 20260918_metricas_limpieza.sql
--
-- 1. Campos de reserva/ingreso pendiente en habitaciones
-- 2. Validador estricto de transiciones (por estado de origen + rol del usuario)
-- 3. Transición automática al finalizar la limpieza:
--    Limpia/Lista -> Ocupada (si hay huésped/ingreso pendiente) ó -> Disponible
-- ============================================================

-- 1) Campos de entrada programada / huésped asignado
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS ingreso_pendiente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proximo_ingreso_at timestamptz;

-- 2) Validador estricto de transiciones (sustituye la regla RN-01 simple)
--    Matriz base (sin rol): un estado solo puede ir a los destinos permitidos.
--    Gating por rol: recepción no toca Sucia / En Limpieza;
--    limpieza solo inicia (Sucia->En Limpieza) y finaliza (En Limpieza->Limpia/Lista).
CREATE OR REPLACE FUNCTION public.fn_rooms_validar_transicion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_origen  text;
  v_destino text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Transición automática disparada internamente (finalizar limpieza): no volver a validar
  IF current_setting('app.apphr_auto_transicion', true) = 'true' THEN
    RETURN NEW;
  END IF;

  v_origen  := OLD.status;
  v_destino := NEW.status;

  -- Obtenemos el rol del usuario autenticado (n8n / service role => NULL => servicio)
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = auth.uid();

  -- 2.1 Matriz base: destinos permitidos según el estado de origen
  IF v_origen = 'Disponible' AND v_destino NOT IN ('Ocupada', 'Mantenimiento') THEN
    RAISE EXCEPTION 'Transición prohibida: Disponible -> %', v_destino;
  ELSIF v_origen = 'Ocupada' AND v_destino NOT IN ('Sucia', 'Mantenimiento') THEN
    RAISE EXCEPTION 'Transición prohibida: Ocupada -> %', v_destino;
  ELSIF v_origen = 'Sucia' AND v_destino NOT IN ('En Limpieza') THEN
    RAISE EXCEPTION 'Transición prohibida: Sucia -> % (debe iniciarse limpieza)', v_destino;
  ELSIF v_origen = 'En Limpieza' AND v_destino NOT IN ('Limpia/Lista') THEN
    RAISE EXCEPTION 'Transición prohibida: En Limpieza -> % (solo finaliza a Limpia/Lista)', v_destino;
  ELSIF v_origen = 'Limpia/Lista' AND v_destino NOT IN ('Ocupada', 'Disponible') THEN
    RAISE EXCEPTION 'Transición prohibida: Limpia/Lista -> %', v_destino;
  ELSIF v_origen = 'Mantenimiento' AND v_destino NOT IN ('Disponible', 'Ocupada', 'Sucia') THEN
    RAISE EXCEPTION 'Transición prohibida: Mantenimiento -> %', v_destino;
  END IF;

  -- 2.2 Gating por rol
  IF v_role = 'limpieza' THEN
    IF v_origen NOT IN ('Sucia', 'En Limpieza') THEN
      RAISE EXCEPTION 'El personal de limpieza solo puede iniciar o finalizar limpiezas (estado actual: %)', v_origen;
    ELSIF v_origen = 'Sucia' AND v_destino <> 'En Limpieza' THEN
      RAISE EXCEPTION 'El personal de limpieza solo puede iniciar limpieza desde Sucias';
    ELSIF v_origen = 'En Limpieza' AND v_destino <> 'Limpia/Lista' THEN
      RAISE EXCEPTION 'El personal de limpieza solo puede finalizar a Limpia/Lista';
    END IF;
  ELSIF v_role IN ('recepcionista', 'recepcion') THEN
    IF v_origen IN ('Sucia', 'En Limpieza') THEN
      RAISE EXCEPTION 'Recepción no puede modificar habitaciones en %; solo el personal de limpieza', v_origen;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_validar_transicion ON public.rooms;
CREATE TRIGGER trg_rooms_validar_transicion
  BEFORE UPDATE OF status ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.fn_rooms_validar_transicion();

-- 3) Transición automática al finalizar la limpieza:
--    La camarera deja la habitación en Limpia/Lista; el sistema decide el destino final:
--      - Hay huésped/entrada pendiente (ingreso_pendiente o proximo_ingreso_at) => Ocupada
--      - Sin ingresos pendientes                                        => Disponible
CREATE OR REPLACE FUNCTION public.fn_rooms_finalizar_ocupacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_destino text;
BEGIN
  IF OLD.status <> 'En Limpieza' OR NEW.status <> 'Limpia/Lista' THEN
    RETURN NEW;
  END IF;

  IF NEW.ingreso_pendiente OR NEW.proximo_ingreso_at IS NOT NULL THEN
    v_destino := 'Ocupada';
  ELSE
    v_destino := 'Disponible';
  END IF;

  -- Marca la transición como automática para que el validador no la revalide por rol
  PERFORM set_config('app.apphr_auto_transicion', 'true', true);

  -- La bitácora registra ambos eventos: En Limpieza -> Limpia/Lista (con duración/SLA)
  -- y Limpia/Lista -> v_destino (sin duración, no alimenta métricas).
  UPDATE public.rooms
    SET status = v_destino,
        ingreso_pendiente = CASE WHEN v_destino = 'Ocupada' THEN false ELSE ingreso_pendiente END,
        proximo_ingreso_at = CASE WHEN v_destino = 'Ocupada' THEN NULL ELSE proximo_ingreso_at END
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_finalizar_ocupacion ON public.rooms;
CREATE TRIGGER trg_rooms_finalizar_ocupacion
  AFTER UPDATE OF status ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.fn_rooms_finalizar_ocupacion();