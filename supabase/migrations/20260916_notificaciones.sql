-- Notificaciones del panel de limpieza (insertadas por n8n / webhooks)
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete cascade,
  habitacion_id uuid references public.rooms(id) on delete cascade,
  titulo text not null,
  mensaje text not null,
  tipo text not null default 'warning',
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notificaciones enable row level security;

-- Leer: solo usuarios del mismo hotel
drop policy if exists "notificaciones_select_own_hotel" on public.notificaciones;
create policy "notificaciones_select_own_hotel"
  on public.notificaciones for select
  to authenticated
  using (hotel_id = (select hotel_id from public.profiles where id = auth.uid()));

-- Insertar: solo usuarios del mismo hotel (n8n usa la Service Role, que omite RLS)
drop policy if exists "notificaciones_insert_own_hotel" on public.notificaciones;
create policy "notificaciones_insert_own_hotel"
  on public.notificaciones for insert
  to authenticated
  with check (hotel_id = (select hotel_id from public.profiles where id = auth.uid()));

-- Marcar como leída: solo del propio hotel
drop policy if exists "notificaciones_update_own_hotel" on public.notificaciones;
create policy "notificaciones_update_own_hotel"
  on public.notificaciones for update
  to authenticated
  using (hotel_id = (select hotel_id from public.profiles where id = auth.uid()))
  with check (hotel_id = (select hotel_id from public.profiles where id = auth.uid()));

-- Habilitar tiempo real para las notificaciones
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;