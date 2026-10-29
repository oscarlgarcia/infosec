# Guía de pruebas — Fase R2: SLA + Entregables

> Alcance: `SlaPolicy`, `BusinessCalendar`, motor de SLA con horas laborables y
> pausas, scheduler idempotente, recordatorios, follow-ups programados,
> `Deliverable` con versiones y validador, métricas event-based.
>
> Requisitos: haber completado R0/R1 y tener al menos una request abierta.

## 1. Pruebas automatizadas

```powershell
npm test
```

`tests/sla.test.ts` cubre:
- suma de minutos laborables, fines de semana, festivos y horario custom;
- `addSlaTime` con `businessHoursOnly` verdadero/falso;
- `computeSlaState`: `on_track`, `at_risk`, `breached`, `paused`;
- cálculo sin usar `updatedAt`.

## 2. Catálogos y configuración por defecto

```powershell
Invoke-RestMethod http://localhost:3000/api/sla-policies -Headers $headers
Invoke-RestMethod http://localhost:3000/api/business-calendars -Headers $headers
Invoke-RestMethod http://localhost:3000/api/catalogs -Headers $headers
```

**Validación:**
- Existe una política `Default` y un calendario `Default (Europe/Madrid)`.
- `GET /api/catalogs` devuelve `requestTypes`, `contractTypes`, `serviceModels`
  como catálogos cerrados.

## 3. Cálculo de SLA en el alta

1. Crea una request con prioridad `P1` y comprueba las fechas:

```powershell
$req = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ clientId=$client.id; requestType='InfoSec Support'; priority='P1'; overrideDuplicate=$true } | ConvertTo-Json)

$req.slaResponseDueAt
$req.slaResolutionDueAt
$req.slaState
```

**Validación:** ambas fechas caen dentro del horario laboral (09:00–18:00,
lunes a viernes, `Europe/Madrid`) y `slaState = on_track`.

2. Crea una política específica:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/sla-policies `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ name='P1 rápido'; priority='P1'; responseHours=2; resolutionHours=8; businessHoursOnly=$true } | ConvertTo-Json)
```

**Validación:** una nueva request `P1` usa la política más específica (la de mayor
puntuación: tipo > prioridad > tipo de cliente).

## 4. Pausas de SLA

```powershell
# Pausa al esperar al cliente
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($req.id)/status" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ status='waiting_client'; reason='Falta documentación' } | ConvertTo-Json)

$sla = Invoke-RestMethod "http://localhost:3000/api/requests/$($req.id)/sla" -Headers $headers
$sla.request.slaState   # paused
$sla.request.slaPausedAt
```

**Validación:**
- `slaState = paused` y `slaPausedAt` informado.
- Al volver a `working`, `pausedMsTotal` crece y las fechas `slaResponseDueAt` /
  `slaResolutionDueAt` se desplazan exactamente el tiempo pausado.
- El evento `status_change` queda en el logbook.

## 5. Scheduler idempotente

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/sla/run-sweep -Headers $headers
Invoke-RestMethod -Method Post http://localhost:3000/api/sla/run-sweep -Headers $headers

$events = Invoke-RestMethod "http://localhost:3000/api/requests/$($req.id)/events" -Headers $headers
$events | Where-Object { $_.type -in @('sla_at_risk','sla_breached') }
```

**Validación:** tras dos barridos consecutivos, `sla_breached` aparece **una sola
vez** (dedupe por `metadata.dedupeKey`). Si `atRiskThresholdPct = 25`, una request
al 80 % de su SLA pasa a `at_risk`.

> No es necesario esperar al scheduler: `SLA_SCHEDULER_INTERVAL_MS` permite
> reducirlo en desarrollo; el arranque hace un primer barrido a los 10 s.

## 6. Follow-up programado

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($req.id)/follow-ups" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ dueAt=(Get-Date).AddDays(2).ToString('o'); note='Recordar al cliente el DPA' } | ConvertTo-Json)
```

**Validación:** se crea un `ScheduledFollowUp`. Cuando llega la fecha, el barrido
genera un evento `client_followup` y una tarea Kanban; no se duplica.

## 7. Entregables

```powershell
$deliverable = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($req.id)/deliverables" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ name='Informe SOC 2'; type='soc_report'; ownerId=$me.id; validatorId=$validator.id; clientVisible=$true } | ConvertTo-Json)
```

Estados: `draft → in_review → approved → sent`. Prueba:

```powershell
# Aprobación
Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/api/requests/$($req.id)/deliverables/$($deliverable.id)" `
  -Headers $headers -ContentType 'application/json' -Body (@{ status='approved' } | ConvertTo-Json)

# Envío
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($req.id)/deliverables/$($deliverable.id)/send" -Headers $headers
```

**Validación:**
- No se puede pasar a `sent` sin `approved` (validación de servicio).
- `send` registra evento `deliverable_sent` y actualiza `deliveredAt` de la request.
- `GET /api/requests/:id/deliverables/:deliverableId` incluye documentos y
  `sourceVersion`/`sourceSnapshot` si se creó desde Canonical Answer.

## 8. Entregable desde Canonical Answer

```powershell
Body: @{ name='Respuesta cuestionario'; sourceType='canonical_answer'; sourceId='<canonicalId>' }
```

**Validación:** el entregable guarda `sourceVersion` (versión de la respuesta
canónica en el momento de crearse) y un `sourceSnapshot` inmutable.

## 9. Métricas event-based

```powershell
Invoke-RestMethod "http://localhost:3000/api/analytics/requests?windowDays=30" -Headers $headers
```

**Validación:**
- `avg_resolution_days` usa `deliveredAt`/`completedAt`, no `updatedAt`.
- `avg_first_response_hours` usa `firstResponseAt`.
- `sla_compliance_pct` compara el milestone real con `slaResolutionDueAt`.
- `overdue_count` incluye requests con `slaState = breached`.

## 10. UI

| Paso | Resultado esperado |
|---|---|
| `/requests/:id` pestaña SLA | Barra de progreso, estado, fechas y pausas |
| Tabla de requests | Badge de SLA (on track / at risk / breached / paused) |
| Panel de entregables | Estados, validador, versiones y botón Enviar |
| `/sla-policies` | CRUD de políticas y calendarios (admin) |

## 11. Criterio de salida R2

- [ ] El SLA se pausa en `waiting_client` y `on_hold`.
- [ ] El breach se registra una sola vez por request y umbral.
- [ ] Los entregables conservan versión y fuente.
- [ ] No se envía un entregable sin aprobación.
- [ ] Las métricas usan hitos reales, nunca `updatedAt`.
