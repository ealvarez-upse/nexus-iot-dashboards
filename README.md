# Nexus IoT · Monitoreo HVAC

Plataforma propia de monitoreo y control HVAC, al estilo de una plataforma IoT
profesional: sensores BLE de temperatura y humedad (Joyway JW1407HT) que se
conectan a un gateway (Joyway JW1602G4), ingesta de telemetría por HTTP y
dashboards en tiempo real con widgets configurables.

## Alcance de la versión 1

- **Autenticación y roles** — acceso con correo + código de 6 dígitos (sin
  contraseñas). El primer usuario registrado se convierte en **administrador**
  automáticamente; el resto entra como **equipo**.
- **Dispositivos** — registro de gateways y sensores con **token de acceso
  único**, estado en línea/offline, valores actuales y gráficas por clave.
- **Dashboards** — constructor visual de widgets: serie temporal, valor actual
  e indicador (gauge), con dispositivo, clave, color, unidad y ancho
  configurables. Todo se actualiza en vivo.
- **API de telemetría** — `POST /api/v1/{token}/telemetry`, **compatible con
  ThingsBoard** (tu gateway ya sabe hablar este formato).
- **Datos demo** — en el primer acceso se crea un sensor BLE + gateway demo con
  24 h de historial y un dashboard de ejemplo; un cron mantiene los sensores
  demo emitiendo datos cada minuto.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + shadcn/ui + recharts +
  Framer Motion (tema Modern claro/oscuro)
- **Backend/DB:** Convex (funciones, base de datos reactiva, HTTP actions y
  crons)
- **Auth:** Convex Auth con proveedor email OTP

## Estructura

```
src/
  convex/            # Backend: schema, devices, dashboards, users, http, demo, crons
  components/
    layout/          # Shell autenticado (sidebar + header)
    widgets/         # Sistema de widgets de telemetría
    ui/              # Componentes shadcn/ui
  pages/
    Landing.tsx      # Landing pública (estilo Monnit, enfoque HVAC)
    Auth.tsx         # Ingreso con correo + código
    app/             # Experiencia autenticada (/app)
      OverviewPage.tsx
      DevicesPage.tsx
      DeviceDetailPage.tsx
      DashboardsPage.tsx
      DashboardViewPage.tsx
      UsersPage.tsx
```

## API de telemetría

Cada dispositivo tiene un token de acceso (visible en su página de detalle).
Publica lecturas con:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"temperature":23.5,"humidity":54}' \
  https://TU-DEPLOYMENT.convex.cloud/api/v1/TU_TOKEN/telemetry
```

Formatos aceptados (idénticos a ThingsBoard):

- Objeto plano: `{"temperature": 23.5}`
- Arreglo: `[{"temperature": 23.5}, {"humidity": 54}]`
- Con timestamp: `{"ts": 1690000000000, "values": {"temperature": 23.5}}`

## Desarrollo

```bash
bun install
bun convex dev --once   # despliega funciones Convex y genera tipos
bun run dev             # servidor de desarrollo
bun tsc -b --noEmit     # verificación de tipos
```

## Despliegue (Contabo + dominio propio)

1. `bunx convex deploy` — crea el deployment de producción.
2. `bun run build` — genera `dist/` con la URL del deployment.
3. Copia `dist/` al VPS y sírvelo con **Caddy** (HTTPS automático) o nginx.
4. DNS: registro `A` de `iot.tudominio.com` → IP del servidor.
5. Los dispositivos publican en
   `https://<deployment>.convex.cloud/api/v1/TOKEN/telemetry` (opcionalmente se
   puede exponer un proxy `api.tudominio.com` → Convex).

## Licencia y propiedad

© 2026 Nexus IoT. Código propiedad del equipo del proyecto.
