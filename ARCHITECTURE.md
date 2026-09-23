# Arquitectura de AppHR

## 1. Visión general

AppHR utiliza una arquitectura **Jamstack y Serverless orientada a eventos**. La interfaz se implementa con Next.js App Router y se despliega como una aplicación web en Vercel. La persistencia, autenticación, autorización y sincronización en tiempo real se delegan a Supabase. Los procesos de integración se ejecutan mediante API Routes de Next.js y workflows de n8n.

```text
Navegador / App Android (Capacitor)
        |
        | HTTPS + Supabase JS
        v
Next.js App Router en Vercel
        |                         \
        | Auth, PostgREST,          \ API Route /api/webhook/checkout
        | Realtime (WebSocket)       \
        v                             v
Supabase PostgreSQL              n8n Webhook
        ^                             |
        | RLS por hotel_id            | REST con credencial de servicio
        +-----------------------------+
```

La arquitectura evita mantener un servidor de aplicación tradicional con estado propio. El frontend consulta y modifica datos mediante Supabase, mientras que los eventos operativos se propagan a los clientes suscritos y, cuando corresponde, a n8n.

## 2. Capas del sistema

### Presentación

Las rutas de interfaz viven en `app/` y utilizan componentes React. Las vistas principales son:

- `app/page.tsx`: landing pública.
- `app/login/page.tsx` y `app/registro/page.tsx`: acceso y alta de hoteles.
- `app/recepcionista/page.tsx`: operaciones de recepción.
- `app/limpieza/page.tsx`: operaciones de limpieza en formato mobile-first.
- `app/admin/page.tsx`: indicadores y administración gerencial.

Los componentes reutilizables se encuentran en `components/`, y el cliente browser de Supabase se centraliza en `lib/supabase.ts`.

### Servicios serverless

Las API Routes de Next.js funcionan como endpoints serverless. Por ejemplo, `app/api/webhook/checkout/route.ts` recibe el evento de check-out y realiza la llamada HTTP al webhook de n8n desde el servidor, evitando depender de una llamada directa del navegador.

Supabase Edge Functions se utiliza para operaciones que requieren privilegios de servidor, como `supabase/functions/cambiar-password/`. Las claves de servicio no deben exponerse al cliente.

### Datos y plataforma

Supabase proporciona PostgreSQL, Auth, PostgREST, Realtime y las políticas RLS. Vercel aloja el frontend Next.js y ejecuta sus API Routes. Capacitor empaqueta el build web para Android sin duplicar la lógica de negocio.

## 3. Modelo multitenant y seguridad RLS

El tenant raíz es `hotels`. Las entidades operativas incluyen un `hotel_id` que identifica a qué hotel pertenecen los datos:

- `profiles`: usuarios, roles y hotel asociado.
- `zonas`: pisos o sectores del hotel.
- `rooms`: habitaciones y estado operativo.
- `ciclos_limpieza`: sesiones de limpieza abiertas y finalizadas.
- `historial_estados_habitacion`: bitácora de transiciones.
- `room_type_config`: tiempos estándar y SLA por tipo de habitación.
- `metricas_limpieza` y `metricas_limpieza_detalle`: indicadores agregados para gerencia.

El aislamiento se implementa en dos niveles:

1. La aplicación obtiene el perfil autenticado y filtra las consultas por `hotel_id`.
2. PostgreSQL aplica Row Level Security (RLS), de modo que una sesión no pueda leer o modificar filas de otro hotel aunque intente alterar los parámetros de una consulta.

Supabase Auth gestiona la identidad. Las operaciones que necesitan privilegios elevados, como una Edge Function o un workflow n8n, deben ejecutarse con credenciales de servicio almacenadas exclusivamente en el entorno server-side correspondiente.

## 4. Comunicación en tiempo real

Los paneles operativos se suscriben a cambios de PostgreSQL mediante Supabase Realtime y eventos `postgres_changes`:

1. Un usuario cambia el estado de una habitación.
2. PostgreSQL valida la transición y ejecuta triggers de historial y métricas.
3. Supabase Realtime publica el cambio a los canales autorizados.
4. Recepción, limpieza y dashboard actualizan su estado sin recargar la página.

Las suscripciones principales se implementan en `app/recepcionista/page.tsx`, `app/limpieza/page.tsx` y `app/admin/page.tsx`. El panel de limpieza también calcula el cronómetro y las alertas SLA en el cliente.

## 5. Flujo de webhooks y n8n

El flujo de check-out es orientado a eventos:

1. Recepción cambia una habitación a `Check-Out`.
2. El cliente llama a la API Route `/api/webhook/checkout`.
3. La API Route reenvía el payload al webhook de n8n configurado en `NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL`.
4. n8n procesa el evento y actualiza `rooms` en Supabase mediante REST.
5. Supabase Realtime notifica el nuevo estado `Sucia` al panel de limpieza.

El workflow de referencia se encuentra en `n8n/workflow-checkout-sucia.json`. Las credenciales de Supabase utilizadas por n8n deben ser propias de la instancia y mantenerse fuera del repositorio.

## 6. Despliegue

```text
Repositorio Git
      |
      v
Vercel: npm run build -> aplicación Next.js
      |
      +--> Variables de entorno públicas y server-side
      +--> Supabase: base de datos, Auth, Realtime y RLS
      +--> n8n: workflows y webhooks externos
```

El proyecto Android se actualiza después de generar el build web mediante `npx cap sync android`. Este paso es independiente del despliegue web en Vercel.