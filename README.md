# AppHR

## Sistema de gestión hotelera en tiempo real

AppHR es una plataforma web multitenant para coordinar la operación de un hotel desde recepción, limpieza y gerencia. Centraliza el estado de las habitaciones, registra los ciclos de limpieza y proporciona información operativa actualizada en tiempo real mediante Supabase Realtime.

El sistema está diseñado con una interfaz responsive y mobile-first para que el personal de limpieza pueda utilizar el módulo operativo desde un teléfono o una aplicación Android empaquetada con Capacitor.

## Características principales

- **Tablero de recepción en tiempo real:** visualización y actualización del estado de las habitaciones mediante canales WebSocket de Supabase Realtime.
- **Módulo móvil de limpieza:** cola de habitaciones, prioridades, registro de inicio y finalización, cronómetro y control de SLA.
- **Automatización con n8n:** webhooks para procesar eventos operativos, como el cambio de una habitación a `Sucia` después de un check-out.
- **Dashboard gerencial:** indicadores de limpieza, cumplimiento de SLA, gráficos y configuración de tiempos por tipo de habitación.
- **Gestión multitenant:** hoteles, usuarios, zonas y habitaciones aislados mediante `hotel_id` y políticas RLS.
- **Autenticación y roles:** acceso diferenciado para `admin`, `recepcionista` y `limpieza` mediante Supabase Auth.
- **Aplicación móvil Android:** proyecto nativo generado con Capacitor a partir del build web estático.

## Stack tecnológico

- **Frontend:** Next.js `16.3.4` con App Router y React `19.2.8`.
- **Lenguaje:** TypeScript.
- **Estilos e interfaz:** Tailwind CSS `v4` y `lucide-react`.
- **Datos y autenticación:** Supabase PostgreSQL, Supabase Auth, PostgREST y Supabase Realtime.
- **Seguridad:** Row Level Security (RLS) y aislamiento por `hotel_id`.
- **Automatización:** n8n mediante webhooks HTTP.
- **Aplicación móvil:** Capacitor para Android.
- **Pruebas:** Playwright para pruebas end-to-end.
- **Despliegue web:** Vercel.

## Estructura principal

| Ruta | Responsabilidad |
| --- | --- |
| `app/page.tsx` | Landing pública. |
| `app/login/page.tsx` | Inicio de sesión. |
| `app/registro/page.tsx` | Registro de hotel y administrador. |
| `app/recepcionista/page.tsx` | Tablero operativo de recepción. |
| `app/limpieza/page.tsx` | Módulo móvil de limpieza. |
| `app/limpieza/historial/page.tsx` | Historial de estados y ciclos. |
| `app/admin/page.tsx` | Dashboard gerencial y administración. |
| `app/api/webhook/checkout/route.ts` | Proxy server-side hacia el webhook de checkout de n8n. |
| `app/api/notifications/sla/route.ts` | Endpoint de notificaciones SLA. |
| `components/` | Componentes compartidos y de la landing. |
| `lib/` | Cliente Supabase, notificaciones y utilidades. |
| `supabase/migrations/` | Esquema, RLS, triggers y funciones PostgreSQL. |
| `supabase/functions/` | Edge Functions de Supabase. |
| `n8n/` | Workflows importables y documentación de automatización. |
| `android/` | Proyecto Android de Capacitor. |

La explicación detallada de capas, datos y flujos se encuentra en [ARCHITECTURE.md](ARCHITECTURE.md).

## Requisitos previos

- Node.js 20 o superior recomendado.
- npm 10 o superior.
- Un proyecto de Supabase con sus migraciones aplicadas.
- Una instancia de n8n si se desea habilitar la automatización de webhooks.

## Instalación y configuración

1. Clonar el repositorio y acceder a su directorio:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd apphr
   ```

2. Instalar las dependencias:

   ```bash
   npm install
   ```

3. Crear el archivo local de variables de entorno a partir de la plantilla:

   ```bash
   cp .env.example .env.local
   ```

4. Completar `.env.local` con la URL y las claves del proyecto Supabase. Las variables de n8n son opcionales si no se utilizarán sus workflows. Nunca publicar claves de servicio ni el archivo `.env.local`.

5. Aplicar las migraciones SQL ubicadas en `supabase/migrations/` en el orden indicado por la documentación de Supabase. Para la función de cambio de contraseña, desplegar `supabase/functions/cambiar-password/` mediante Supabase CLI.

## Desarrollo

Levantar el servidor local:

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3002](http://localhost:3002).

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto `3002`. |
| `npm run build` | Compilación de producción de Next.js. |
| `npm run start` | Servidor de producción en el puerto `3002`. |
| `npm run lint` | Análisis estático con ESLint. |
| `npm run test:e2e` | Pruebas end-to-end con Playwright. |

Las pruebas por rol requieren `E2E_HOTEL_CODE`, `E2E_EMAIL`, `E2E_PASSWORD` y, opcionalmente, `E2E_ROLE`. La URL base puede cambiarse con `E2E_BASE_URL`.

## Automatización con n8n

El workflow [`n8n/workflow-checkout-sucia.json`](n8n/workflow-checkout-sucia.json) recibe el evento de check-out y actualiza la habitación en Supabase. Para habilitarlo:

1. Importar el JSON en n8n.
2. Configurar credenciales propias de Supabase en n8n.
3. Activar el webhook de producción.
4. Guardar su URL en `NEXT_PUBLIC_N8N_CHECKOUT_WEBHOOK_URL`.

La aplicación envía el evento a `/api/webhook/checkout`, y la API Route realiza la llamada server-side al webhook configurado.

## Despliegue en Vercel

1. Importar el repositorio en [Vercel](https://vercel.com/).
2. Configurar las variables de `.env.example` en la sección **Environment Variables** para los entornos correspondientes.
3. Usar `npm run build` como comando de build si Vercel no lo detecta automáticamente.
4. Verificar en Supabase que las migraciones, RLS y Edge Functions estén desplegadas.
5. Configurar las URLs de producción de n8n cuando se utilice automatización.

Vercel aloja la aplicación Next.js; Supabase continúa siendo responsable de PostgreSQL, autenticación, Realtime y las Edge Functions.

## Documentación adicional

- [Arquitectura del sistema](ARCHITECTURE.md)
- [Documentación técnica existente](docs/DOCUMENTACION_TECNICA.md)
- [Configuración de workflows n8n](n8n/README.md)
- [Pruebas E2E](e2e/app.spec.ts)