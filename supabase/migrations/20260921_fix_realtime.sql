-- ============================================================
-- AppHR - Verificar y reparar Realtime para métricas
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- 1. Verificar que las tablas están en la publicación realtime
SELECT schemaname, tablename, pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('metricas_limpieza', 'metricas_limpieza_detalle', 'ciclos_limpieza', 'rooms');

-- 2. Si faltan, agregarlas (idempotente)
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['metricas_limpieza', 'metricas_limpieza_detalle', 'ciclos_limpieza', 'rooms'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        RAISE NOTICE 'Added % to supabase_realtime', t;
      ELSE
        RAISE NOTICE '% already in supabase_realtime', t;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 3. Verificar REPLICA IDENTITY FULL
SELECT schemaname, tablename, replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('metricas_limpieza', 'metricas_limpieza_detalle', 'ciclos_limpieza', 'rooms')
  AND c.relreplident = 'f'; -- 'f' = FULL

-- 4. Si falta REPLICA IDENTITY FULL, agregarlo
ALTER TABLE public.metricas_limpieza REPLICA IDENTITY FULL;
ALTER TABLE public.metricas_limpieza_detalle REPLICA IDENTITY FULL;
ALTER TABLE public.ciclos_limpieza REPLICA IDENTITY FULL;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

-- 5. Test manual: hacer un UPDATE dummy para disparar realtime
-- (Cambia 'tu-hotel-id' por un ID real de tu hotel)
-- UPDATE public.metricas_limpieza SET updated_at = now() WHERE hotel_id = 'tu-hotel-id';

-- 6. Verificar que el trigger fn_gestion_completa_habitacion existe y está activo
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_rooms_gestion_estados';

-- 7. Verificar permisos RLS en las tablas de métricas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('metricas_limpieza', 'metricas_limpieza_detalle', 'ciclos_limpieza');