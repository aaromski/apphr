-- ============================================================
-- AppHR - Prioridad de habitaciones (is_priority)
-- Ejecutar en el SQL Editor de Supabase (Dashboard -> SQL)
-- Permite marcar habitaciones como prioritarias desde Recepción
-- ============================================================

-- Columna booleana de prioridad (por defecto false, no altera el comportamiento actual)
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

-- Índice opcional para consultas de prioridad por hotel
CREATE INDEX IF NOT EXISTS idx_rooms_prioridad
  ON public.rooms (hotel_id, is_priority);