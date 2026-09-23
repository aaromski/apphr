-- ============================================================
-- AppHR - Agregar columna check_out_at para distinguir check-out real vs cambio manual a Sucia
-- ============================================================

-- 1) Agregar columna para marcar check-out explícito
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS check_out_at timestamptz;

-- 2) Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_rooms_check_out_at ON public.rooms (check_out_at) WHERE check_out_at IS NOT NULL;

-- 3) Comentario
COMMENT ON COLUMN public.rooms.check_out_at IS 'Timestamp cuando se realizó check-out explícito. Se usa en trigger para distinguir check-out real vs cambio manual a Sucia. Se limpia al iniciar limpieza.';

-- 4) Actualizar trigger para usar esta columna
DROP TRIGGER IF EXISTS trg_rooms_gestion_estados ON public.rooms;

CREATE OR REPLACE FUNCTION public.fn_gestion_completa_habitacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sla             integer;
    v_duracion_seg    integer;
    v_sla_seg         integer;
    v_cumplio         boolean;
    v_duracion_min    integer;
    v_exceso          integer;
    v_uid             uuid;
    v_personal_nombre text;
    v_cum             integer;
    v_retrasada       integer;
    v_estado_origen   text;
    v_room_type_id    uuid;
    v_room_type_name  text;
BEGIN
    -- Si el estado no cambió, no hacemos nada
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    -- Obtener el usuario actual desde la sesión o el último movimiento
    v_uid := auth.uid();

    -- =========================================================================
    -- PASO A: NACE EL CICLO (Cuando la habitación pasa a 'Sucia')
    -- =========================================================================
    -- Detectar check-out real: transición Ocupada -> Sucia CON check_out_at seteado en el MISMO update
    -- Se usa NEW.check_out_at (valor nuevo) porque el UPDATE setea check_out_at y status en la misma query
    IF NEW.status = 'Sucia' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.ciclos_limpieza (
            hotel_id, habitacion_id, estado_origen, sucia_at
        ) VALUES (
            NEW.hotel_id, NEW.id, 
            CASE 
                WHEN OLD.status = 'Ocupada' AND NEW.check_out_at IS NOT NULL 
                     AND NEW.check_out_at > (now() - interval '5 seconds')
                THEN 'Check-Out' 
                ELSE OLD.status 
            END,
            now()
        );
        
        -- Limpiar check_out_at después de usarlo (ya no es necesario)
        NEW.check_out_at := NULL;
    END IF;

    -- =========================================================================
    -- PASO B: INICIA LA LIMPIEZA (Se asigna usuario y hora de inicio real)
    -- =========================================================================
    IF OLD.status = 'Sucia' AND NEW.status = 'En Limpieza' THEN
        UPDATE public.ciclos_limpieza
        SET usuario_id = COALESCE(v_uid, usuario_id),
            iniciado_at = now()
        WHERE habitacion_id = NEW.id
          AND iniciado_at IS NULL
          AND finalizado_at IS NULL;
    END IF;

    -- =========================================================================
    -- PASO C: FINALIZA LA LIMPIEZA (Se calcula SLA, duración y destino final)
    -- =========================================================================
    IF OLD.status = 'En Limpieza' AND (NEW.status = 'Limpia/Lista' OR NEW.status = 'Disponible' OR NEW.status = 'Ocupada') THEN
        
        -- Si la habitación pasó directamente a limpia, aseguramos que tenga un inicio registrado
        -- o tomamos el momento en que se creó el ciclo
        UPDATE public.ciclos_limpieza
        SET iniciado_at = COALESCE(iniciado_at, sucia_at)
        WHERE habitacion_id = NEW.id
          AND finalizado_at IS NULL
          AND iniciado_at IS NULL;

        -- Obtener el tipo_habitacion_id de la habitación (nuevo esquema)
        v_room_type_id := NEW.tipo_habitacion_id;

        -- Obtener el SLA configurado para este tipo de habitación usando la FK
        SELECT COALESCE(rtc.sla_min, 45), rtc.room_type
        INTO v_sla, v_room_type_name
        FROM room_type_config rtc
        WHERE rtc.id = v_room_type_id
        LIMIT 1;

        -- Valor por defecto si no hay tipo asignado
        v_sla := COALESCE(v_sla, 45);
        v_sla_seg := v_sla * 60;

        -- Calcular duración real basada estrictamente entre 'iniciado_at' y el momento actual (fin)
        SELECT EXTRACT(EPOCH FROM (now() - iniciado_at))::integer, usuario_id
        INTO v_duracion_seg, v_uid
        FROM public.ciclos_limpieza
        WHERE habitacion_id = NEW.id
          AND finalizado_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1;

        v_duracion_seg := GREATEST(0, COALESCE(v_duracion_seg, 0));
        v_duracion_min := GREATEST(1, CEIL(v_duracion_seg::numeric / 60)::integer);

        v_cumplio := v_duracion_seg <= v_sla_seg;
        v_exceso := CASE WHEN v_cumplio THEN 0 ELSE CEIL((v_duracion_seg - v_sla_seg)::numeric / 60)::integer END;

        -- Cerrar el ciclo de limpieza actual
        UPDATE public.ciclos_limpieza
        SET finalizado_at = now(),
            duracion_min = v_duracion_min,
            sla_min = v_sla,
            cumplio_sla = v_cumplio,
            minutos_excedidos = v_exceso
        WHERE habitacion_id = NEW.id
          AND finalizado_at IS NULL;

        -- Determinar el estado destino automático basado en el estado de origen del ciclo
        -- estado_origen será 'Check-Out' (check-out real), 'Ocupada' (estancia normal), 'Mantenimiento', etc.
        -- Check-Out -> Disponible (siguiente huésped)
        -- Ocupada (estancia normal) -> Ocupada (huésped sigue/regresa)
        -- Mantenimiento u otros -> Disponible
        SELECT estado_origen INTO v_estado_origen
        FROM public.ciclos_limpieza
        WHERE habitacion_id = NEW.id
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_estado_origen ILIKE '%check-out%' THEN
            -- Check-Out real -> Disponible para el siguiente huésped
            NEW.status := 'Disponible';
        ELSIF v_estado_origen ILIKE '%ocupada%' THEN
            -- Estancia normal (Ocupada) -> el huésped sigue/regresa, queda Ocupada
            NEW.status := 'Ocupada';
        ELSE
            -- Mantenimiento u otros -> Disponible
            NEW.status := 'Disponible';
        END IF;

        -- =========================================================================
        -- PASO D: ALIMENTAR MÉTRICAS Y AUDITORÍA GENERAL
        -- =========================================================================
        v_cum := CASE WHEN v_cumplio THEN 1 ELSE 0 END;
        v_retrasada := CASE WHEN v_cumplio THEN 0 ELSE 1 END;

        -- 1. Bitácora general de auditoría (Limpia, sin métricas mezcladas)
        INSERT INTO historial_estados_habitacion
            (hotel_id, habitacion_id, usuario_id, estado_anterior, estado_nuevo, fecha_cambio)
        VALUES
            (NEW.hotel_id, NEW.id, v_uid, OLD.status, NEW.status, now());

        -- 2. Resumen general de métricas del hotel
        INSERT INTO metricas_limpieza (hotel_id, total_limpiezas, suma_duracion_min, sla_cumplidas, sla_retrasadas, updated_at)
        VALUES (NEW.hotel_id, 1, v_duracion_min, v_cum, v_retrasada, now())
        ON CONFLICT (hotel_id) DO UPDATE SET
            total_limpiezas     = metricas_limpieza.total_limpiezas + 1,
            suma_duracion_min   = metricas_limpieza.suma_duracion_min + v_duracion_min,
            sla_cumplidas       = metricas_limpieza.sla_cumplidas + v_cum,
            sla_retrasadas      = metricas_limpieza.sla_retrasadas + v_retrasada,
            updated_at          = now();

        -- 3. Desglose de métricas por tipo de habitación
        -- Usamos el nombre del tipo desde room_type_config (vía FK)
        INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, suma_exceso_min, updated_at)
        VALUES (NEW.hotel_id, 'tipo', COALESCE(v_room_type_name, 'Estándar'), COALESCE(v_room_type_name, 'Estándar'), 1, v_duracion_min, v_cum, v_exceso, now())
        ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
            limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
            suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion_min,
            cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
            suma_exceso_min   = metricas_limpieza_detalle.suma_exceso_min + v_exceso,
            updated_at        = now();

        -- 4. Desglose de métricas por personal de limpieza
        SELECT nombre INTO v_personal_nombre FROM profiles WHERE id = v_uid;
        IF v_uid IS NOT NULL THEN
            INSERT INTO metricas_limpieza_detalle (hotel_id, dimension, clave, nombre, limpiezas, suma_duracion_min, cumplidas, suma_exceso_min, updated_at)
            VALUES (NEW.hotel_id, 'personal', v_uid::text, COALESCE(v_personal_nombre, 'Personal'), 1, v_duracion_min, v_cum, v_exceso, now())
            ON CONFLICT (hotel_id, dimension, clave) DO UPDATE SET
                limpiezas         = metricas_limpieza_detalle.limpiezas + 1,
                suma_duracion_min = metricas_limpieza_detalle.suma_duracion_min + v_duracion_min,
                cumplidas         = metricas_limpieza_detalle.cumplidas + v_cum,
                suma_exceso_min   = metricas_limpieza_detalle.suma_exceso_min + v_exceso,
                updated_at        = now();
        END IF;

    ELSE
        -- Si es cualquier otro cambio de estado genérico (ej. de Disponible a Ocupada por un check-in)
        INSERT INTO historial_estados_habitacion
            (hotel_id, habitacion_id, usuario_id, estado_anterior, estado_nuevo, fecha_cambio)
        VALUES
            (NEW.hotel_id, NEW.id, v_uid, OLD.status, NEW.status, now());
    END IF;

    RETURN NEW;
END;
$$;

-- Enlazar el trigger a la tabla rooms
CREATE TRIGGER trg_rooms_gestion_estados
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_gestion_completa_habitacion();