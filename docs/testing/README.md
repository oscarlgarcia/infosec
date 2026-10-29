# Guías de prueba — Request 360 + Logbook

Cada fase tiene su propia guía con pruebas automatizadas, pruebas manuales de API,
validaciones en UI y criterio de salida.

| Fase | Documento | Alcance |
|---|---|---|
| R0 | [phase-0.md](./phase-0.md) | Cimientos: modelos, numeración, descargas, multipart, zod, `/api` |
| R1 | [phase-1.md](./phase-1.md) | Intake 360, logbook append-only, hilos, documentos, dedupe |
| R2 | [phase-2.md](./phase-2.md) | SLA, calendarios, pausas, scheduler, entregables, métricas |
| R3 | [phase-3.md](./phase-3.md) | Consultas rápidas, CVE, impacto, IA y artefactos |
| R4 | [phase-4.md](./phase-4.md) | Kanban, dashboards, Cliente 360, notificaciones e inbound email |

## Comandos base

```powershell
npm install
npm run typecheck
npm test
npm run dev
```

## Fixtures

Las pruebas de subida referencian `docs/testing/fixtures/a.pdf` y `b.png`.
Crea la carpeta y copia dos archivos pequeños:

```powershell
New-Item -ItemType Directory -Force docs/testing/fixtures | Out-Null
Copy-Item <ruta-a-un-pdf-pequeno> docs/testing/fixtures/a.pdf
Copy-Item <ruta-a-una-imagen-pequena> docs/testing/fixtures/b.png
```

## Variables de entorno relevantes

| Variable | Uso |
|---|---|
| `REQUEST_360_ENABLED` | Activa rutas, SLA scheduler y lógica 360 |
| `DEFAULT_TIMEZONE` | Zona por defecto de los calendarios (`Europe/Madrid`) |
| `STORAGE_PROVIDER` | `local` o `s3` (S3/MinIO) |
| `S3_*` | Credenciales y bucket cuando `STORAGE_PROVIDER=s3` |
| `SMTP_*` | Envío de email de notificaciones |
| `NOTIFY_WEBHOOK_URL` | Webhook Teams/Slack |
| `EMAIL_INBOUND_SECRET` | Secreto del webhook de entrada de email |
| `SLA_SCHEDULER_ENABLED` / `SLA_SCHEDULER_INTERVAL_MS` | Scheduler de SLA |

> Las pruebas manuales asumen `Authorization: Bearer <token>` en `$headers` y un
> backend en `http://localhost:3000` con prefijo `/api`.
