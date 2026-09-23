# Workflows n8n de AppHR

Plantillas listas para importar en tu instancia de n8n (`Workflows → Import from File`).

## Requisitos previos

1. Ejecutar en Supabase las migraciones:
   - `supabase/migrations/20260915_cleaning_tracking.sql`
   - `supabase/migrations/20260917_historial_trigger_rn01.sql`
   - `supabase/migrations/20260918_metricas_limpieza.sql`
2. Tener la **Service Role Key** de Supabase (Dashboard → Project Settings → API).
3. Configurar en `.env.local` de la app: `NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL` apuntando al webhook del workflow.

> Las notificaciones del panel de limpieza son **locales en el cliente** (escuchan los
> cambios de `rooms` por Realtime). No se usa ninguna tabla `notificaciones` en la base.

## Workflow — `workflow-checkout-sucia.json` (RF-04 / HU-03)

Se dispara cuando recepción registra el estado **Check-Out**.

- **Webhook URL**: `https://TU-INSTANCIA.n8n.cloud/webhook/apphr-checkout`
- Payload: `{ evento: "check_out", hotel_id, habitacion, zona, timestamp }`
- Acción:
  1. `PATCH /rooms` → marca la habitación como `Sucia`.

## Pasos de configuración

1. Importar el JSON en n8n.
2. El template ya incluye el proyecto Supabase de producción y su **Service Role Key**.
   Si copias el proyecto, crea una credencial propia en n8n (*Header Auth*) o actualiza los campos `apikey`/`Authorization`
   para no exponer la key en el repo.
3. Activar el workflow y copiar la **Production URL** del nodo Webhook.
4. Pegar la URL en `.env.local`:
   - `NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL` = URL del webhook `apphr-checkout`.

   > El webhook de check-out lo usa `app/recepcionista/page.tsx`.
   > La alerta SLA del panel de limpieza sigue siendo **client-side** (cronómetro/barra roja);
   > el webhook SLA se mantiene solo si tu instancia n8n tiene un workflow propio para él.
