# AppHR — Documentación Técnica

Sistema de Gestión y Optimización en la Asignación de Habitaciones Hoteleras.
Stack: **Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Supabase (PostgreSQL/Realtime) + n8n + Capacitor (Android)**.

---

## 1. Arquitectura

```
Navegador / App Android (Capacitor)
   │  Next.js (Turbopack) + Tailwind
   │  Supabase JS (Auth + Realtime + PostgREST)
   ▼
Supabase (multi-tenant, RLS por hotel_id)
   ▲
   │  Service Role (solo en Edge Functions / n8n)
n8n  ── webhooks ──►  rooms
```

- **Frontend**: `app/` (rutas), componentes en `components/` y por módulo.
- **Backend/BD**: Supabase. Todo el aislamiento se hace con `hotel_id` + RLS.
- **Automatización**: n8n recibe webhooks de la app y escribe estados vía REST (p. ej. `Check-Out → Sucia`).
- **Notificaciones del panel**: locales en el cliente, generadas al detectar transiciones de `rooms` por Realtime (sin tabla de notificaciones en la BD).
- **Móvil**: Capacitor empaqueta el build estático (`out/`) en Android.

## 2. Estructura de carpetas

| Ruta | Descripción |
| --- | --- |
| `app/page.tsx` | Página de bienvenida / Landing pública corporativa con accesos directos. |
| `app/login/page.tsx` | Inicio de sesión, valida código de hotel + rol + estado activo. |
| `app/registro/page.tsx` | Registro de nuevo hotel y cuenta de Administrador con entrega de código único. |
| `app/admin/page.tsx` | Dashboard gerencial + Gestión Paramétrica + Usuarios. |
| `app/admin/charts.tsx` | Gráficos interactivos (recharts). |
| `app/admin/tiempos-config.tsx` | Parametrización de tiempos/SLA por tipo (RF-05). |
| `app/recepcionista/page.tsx` | Tablero de habitaciones en tiempo real (RF-02). |
| `app/limpieza/page.tsx` | Panel móvil de limpieza, cronómetro y SLA (RF-03/06). |
| `app/limpieza/historial/page.tsx` | Bitácora del personal. |
| `app/limpieza/perfil/page.tsx` | Perfil del usuario. |
| `lib/supabase.ts` | Cliente Supabase (anon key). |
| `supabase/migrations/*.sql` | Esquema, RLS, triggers y funciones. |
| `supabase/functions/cambiar-password/` | Edge Function (service role) para cambiar contraseñas. |
| `n8n/*.json` | Plantillas de workflows importables. |
| `e2e/app.spec.ts` | Pruebas E2E con Playwright. |
| `android/` | Proyecto Android generado por Capacitor. |

## 3. Modelo de datos

| Tabla | Campos clave | Notas |
| --- | --- | --- |
| `hotels` | id, name, code | Inquilino raíz (multitenant). |
| `profiles` | id (=auth.users), hotel_id, nombre, role, email, activo | Roles: `admin`, `recepcionista`, `limpieza`. |
| `zonas` | id, hotel_id, nombre | Pisos/sectores. |
| `rooms` | id, hotel_id, zona_id, room_number, room_type, zone, status, cleaning_started_at | Entidad operativa. Estados: Disponible, Ocupada, Check-Out, Sucia, En Limpieza, Limpia/Lista, Mantenimiento. |
| `historial_estados_habitacion` | id, hotel_id, habitacion_id, usuario_id, estado_anterior, estado_nuevo, fecha_cambio, duracion_min, cumplio_sla | Bitácora **alimentada por trigger**. |
| `room_type_config` | id, hotel_id, room_type, tiempo_estandar_min, sla_min | Parametrización de tiempos (RF-05). UNIQUE(hotel_id, room_type). |
| `metricas_limpieza` | hotel_id (PK), total_limpiezas, suma_duracion_min, sla_cumplidas, sla_retrasadas, updated_at | Resumen KPIs por hotel, **mantenido O(1) por trigger**. |
| `metricas_limpieza_detalle` | hotel_id + dimension + clave (PK), nombre, limpiezas, suma_duracion_min, cumplidas | Desglose por `tipo`/`zona`/`personal` para los gráficos, mantenido por el mismo trigger. |

> Las notificaciones del panel de limpieza (toast + campana) son puramente **client-side**:
> `components/NotificationBell.tsx` detecta la transición de una habitación a `Sucia` vía Realtime
> sobre `rooms` y dispara sonido + aviso. No existe `notificaciones` en la base.

### Orden de ejecución de migraciones
1. `20260915_cleaning_tracking.sql`
2. `20260917_historial_trigger_rn01.sql`
3. `20260918_metricas_limpieza.sql` (métricas realtime del admin)
4. `20260919_registro_hotel.sql` (políticas de autoregistro de hoteles y perfiles)

## 4. Trazabilidad de requisitos

### Requerimientos Funcionales

| Código | Implementación |
| --- | --- |
| RF-01 Autenticación multitenant por rol | `app/page.tsx`, RLS en migraciones, tabla `hotels.code`. |
| RF-02 Tablero de Recepción Realtime | `app/recepcionista/page.tsx` (canal `postgres_changes` sobre `rooms`). |
| RF-03 Registro móvil de limpieza one-touch | `app/limpieza/page.tsx` (botones `h-12` = 48px). |
| RF-04 Automatización post Check-Out | `sendCheckoutWebhook` en `app/recepcionista/page.tsx` + `n8n/workflow-checkout-sucia.json`. |
| RF-05 Parametrización de tiempos | `app/admin/tiempos-config.tsx`, tabla `room_type_config`. |
| RF-06 Alertas por tiempo | Barra de progreso y cronómetro en `app/limpieza/page.tsx` (colores verde/ámbar/rojo). |
| RF-07 Dashboard gerencial | `app/admin/page.tsx` (KPIs + `app/admin/charts.tsx`). KPIs y gráficos en tiempo real vía Realtime sobre `metricas_limpieza` / `metricas_limpieza_detalle` (mantenidas por trigger). |
| RF-08 Gestión paramétrica | Zonas, Habitaciones (por lotes) y Tiempos en `app/admin/page.tsx`. |

### Requerimientos No Funcionales

| Código | Estado |
| --- | --- |
| RNF-01 Seguridad y aislamiento | Supabase Auth (hash bcrypt) + RLS por `hotel_id`; cambio de contraseña por Edge Function. |
| RNF-02 Latencia < 2s | Supabase Realtime (WebSockets); verificable con `e2e/app.spec.ts`. |
| RNF-03 Usabilidad mobile-first (48px) | Botones `h-12`, layout `app/limpieza/`. |
| RNF-04 Disponibilidad 99.5% | Vercel + Supabase (dependiente del hosting). |
| RNF-05 Escalabilidad | Multi-hotel por `hotel_id`, sin cambios de esquema. |
| RNF-06 Compatibilidad navegadores | Next.js/Tailwind estándar. |

### Reglas de Negocio

| Código | Implementación |
| --- | --- |
| RN-01 Inmutabilidad de transición | Trigger `trg_rooms_validar_transicion` (bloquea pasar a `Disponible` sin `Check-Out → Limpia/Lista`). |
| RN-02 Priorización de colas por zona | Filtros por zona y "Prioritarias" en `app/limpieza/page.tsx`; asignación avanzada en n8n. |
| RN-03 Parámetro multitenant | RLS y filtros `.eq('hotel_id', ...)`. |
| RN-04 Parametrización de tiempos | `room_type_config` + `get_room_type_config()`. |

### Historias de Usuario
- **HU-01** (Recepción): `app/recepcionista/page.tsx`.
- **HU-02** (Limpieza): `app/limpieza/page.tsx`.
- **HU-03** (n8n post check-out): `n8n/workflow-checkout-sucia.json`.
- **HU-04** (Dashboard): `app/admin/page.tsx` + `app/admin/charts.tsx`.

## 5. Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://earlammmyhbcnkzlddzs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
N8N_BASE_URL=https://aaromalb.app.n8n.cloud
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://aaromalb.app.n8n.cloud/webhook/apphr-sla-alerta
NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL=https://aaromalb.app.n8n.cloud/webhook/apphr-checkout
```

> La **Service Role Key** nunca se expone al frontend: vive en la Edge Function `cambiar-password`
> (inyectada por Supabase) y en las plantillas de n8n.

## 6. Comandos

```bash
npm run dev            # desarrollo en http://localhost:3002
npm run build          # build de producción (genera out/)
npm run lint           # ESLint
npm run test:e2e       # Playwright (requiere E2E_HOTEL_CODE/E2E_EMAIL/E2E_PASSWORD)
npx cap sync android   # copiar el build web a Android
npx cap open android   # abrir Android Studio
```

## 7. Pruebas E2E

`e2e/app.spec.ts` incluye pruebas de carga del login, rechazo de credenciales y acceso por rol.
Las pruebas de rol se omiten si no se define:

```
E2E_HOTEL_CODE, E2E_EMAIL, E2E_PASSWORD, E2E_ROLE=admin|limpieza|recepcionista
```

## 8. Despliegue

1. **GitHub**: subir el repositorio (`.env.local` está en `.gitignore`).
2. **Vercel**: importar el repo, cargar las variables de entorno y desplegar.
3. **Supabase**: ejecutar las migraciones en orden y desplegar la Edge Function
   (`supabase functions deploy cambiar-password`).
4. **n8n**: importar los workflows y configurar la Service Role Key.
5. **Android**: `npm run build` → `npx cap sync android` → `npx cap open android`.
