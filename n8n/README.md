# Workflows n8n de AppHR

Plantillas listas para importar en tu instancia de n8n (`Workflows → Import from File`).

## Requisitos previos

1. Ejecutar en Supabase las migraciones:
   - `supabase/migrations/20260915_cleaning_tracking.sql`
   - `supabase/migrations/20260916_notificaciones.sql`
   - `supabase/migrations/20260917_historial_trigger_rn01.sql`
   - `supabase/migrations/20260918_metricas_limpieza.sql`
2. Tener la **Service Role Key** de Supabase (Dashboard → Project Settings → API).
3. Configurar en `.env.local` de la app: `NEXT_PUBLIC_N8N_WEBHOOK_URL` apuntando al webhook del workflow correspondiente.

## Workflow 1 — `workflow-sla-alerta.json`

Se dispara cuando el panel de limpieza detecta que una habitación supera su SLA.

- **Webhook URL**: `https://TU-INSTANCIA.n8n.cloud/webhook/apphr-sla-alerta`
- Payload emitido por la app:
  ```json
  {
    "evento": "sla_violacion",
    "hotel_id": "uuid",
    "habitacion": "102",
    "zona": "Piso 1",
    "room_type": "Estándar",
    "sla_min": 45,
    "minutos_transcurridos": 47,
    "minutos_excedidos": 2,
    "timestamp": "2026-09-17T..."
  }
  ```
- Acción: inserta una notificación en la tabla `notificaciones` (aparece en el panel de limpieza en tiempo real).

## Workflow 2 — `workflow-checkout-sucia.json` (RF-04 / HU-03)

Se dispara cuando recepción registra el estado **Check-Out**.

- **Webhook URL**: `https://TU-INSTANCIA.n8n.cloud/webhook/apphr-checkout`
- Payload: `{ evento: "check_out", hotel_id, habitacion, zona, timestamp }`
- Acciones:
  1. `PATCH /rooms` → marca la habitación como `Sucia`.
  2. `POST /notificaciones` → avisa al panel de limpieza.

## Pasos de configuración

1. Importar el JSON en n8n.
2. Los templates ya incluyen el proyecto Supabase de producción y su **Service Role Key**.
   Si copias el proyecto, crea una credencial propia en n8n (*Header Auth*) o actualiza los campos `apikey`/`Authorization`
   para no exponer la key en el repo.
3. Activar el workflow y copiar la **Production URL** del nodo Webhook.
4. Pegar las URLs en `.env.local`:
   - `NEXT_PUBLIC_N8N_WEBHOOK_URL` = URL del webhook `apphr-sla-alerta`.
   - `NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL` = URL del webhook `apphr-checkout`.

   > El webhook SLA lo usa `app/limpieza/page.tsx`; el de check-out, `app/recepcionista/page.tsx`.
   > Si prefieres un único webhook, reemplaza ambos `path` de los workflows por el mismo y repite la sección
   > CONNECTIONS con un nodo *Switch* que revise `body.evento`.
