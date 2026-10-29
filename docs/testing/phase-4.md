# Guía de pruebas — Fase R4: Kanban avanzado + Dashboards + Notificaciones

> Alcance: `Task` con atributos de negocio, tarjeta Kanban enriquecida,
> sincronización request ↔ task, `dashboard.service`, Cliente 360, dashboard
> global, `Notification` in-app, email SMTP, webhook y entrada de email.
>
> Requisitos: R0–R3 completos. Para email: `SMTP_*` configurado. Para webhook:
> `NOTIFY_WEBHOOK_URL`. Para inbound: `EMAIL_INBOUND_SECRET`.

## 1. Pruebas automatizadas

```powershell
npm test
```

Cobertura: transiciones de estado, numeración, SLA y serializer (la base que
consumen los dashboards y el Kanban).

## 2. Kanban enriquecido

1. Crea una request estándar (genera tarjeta en `TODO`):

```powershell
$task = (Invoke-RestMethod "http://localhost:3000/api/tasks?requestId=$($req.id)" -Headers $headers).items[0]
$task | Select-Object name, priority, severity, requestType, requestKey, deadline, slaState, taskType, clientId
```

**Validación:** la tarjeta hereda `clientId`, `requestKey`, `requestType`,
`priority`, `severity`, `deadline` y `taskType` de la request.

2. Filtra el tablero:

```powershell
Invoke-RestMethod "http://localhost:3000/api/tasks?priority=P1&ownerId=$($me.id)&slaState=breached" -Headers $headers
```

**Validación:** los filtros combinan (AND) y el resultado se puede agrupar por
prioridad, propietario o estado SLA (swimlanes).

## 3. Sincronización request ↔ task

```powershell
# Completar la tarea
Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/tasks/$($task.id)" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ status='Completed' } | ConvertTo-Json)

$events = Invoke-RestMethod "http://localhost:3000/api/requests/$($req.id)/events" -Headers $headers
$events | Where-Object { $_.type -eq 'task_linked' }
```

**Validación:**
- Cambiar de lista o completar la tarea registra `task_linked` en el logbook.
- Un cambio de estado de la request refleja `slaState`/`deadline` en la tarjeta.
- No se duplican tarjetas al actualizar la request.

## 4. Dashboard global

```powershell
$dash = Invoke-RestMethod "http://localhost:3000/api/dashboard/global?windowDays=90" -Headers $headers
$dash | ConvertTo-Json -Depth 4
```

**Validación:**
- `byStatus` incluye los 8 estados y suma el total de requests de la ventana.
- `byPriority`, `bySeverity`, `byType`, `aging` (0-2/3-7/8-30/>30) y `byClient`
  cuadran con los datos de prueba.
- `workload` agrega por `infosecOwnerId`, `salesOwnerId` y `clientOwnerId`.
- Los tiempos se calculan con `createdAt`, `firstResponseAt`, `deliveredAt`.

## 5. Cliente 360

```powershell
$client360 = Invoke-RestMethod "http://localhost:3000/api/dashboard/client/$($client.id)" -Headers $headers
$client360 | ConvertTo-Json -Depth 4
```

**Validación:** incluye datos de cuenta, stakeholders, requests abiertas/cerradas,
entregables, impactos CVE, SLA y actividad reciente; cada item enlaza a su request.

## 6. Mi carga de trabajo

```powershell
Invoke-RestMethod http://localhost:3000/api/dashboard/my-workload -Headers $headers
```

**Validación:** solo devuelve requests donde el usuario es owner (Infosec, sales o
client owner) o stakeholder, con contadores de abiertas y vencidas.

## 7. Notificaciones in-app

```powershell
# Asigna la request a otro usuario para disparar notificación
Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/api/requests/$($req.id)" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ infosecOwnerId=$otherUser.id } | ConvertTo-Json)

# Como el otro usuario
Invoke-RestMethod "http://localhost:3000/api/notifications?unread=true" -Headers $otherHeaders
```

**Validación:**
- Se crea una `Notification` con `link` a la request y `type` de asignación.
- `POST /api/notifications/:id/read` la marca leída.
- `POST /api/notifications/read-all` pone el contador a 0.
- La campana del `Layout` muestra el número de no leídas y navega al hacer clic.

## 8. Email SMTP

Con `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` configurados:

```powershell
$prefs = @{ emailEnabled=$true; inAppEnabled=$true; webhookEnabled=$false; mentionEmail=$true } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/notification-preferences `
  -Headers $headers -ContentType 'application/json' -Body $prefs
```

**Validación:**
- La notificación de asignación llega al buzón del usuario.
- Sin SMTP configurado no falla la operación: el canal email se omite y queda la in-app.
- Las preferencias persisten y se respetan por tipo de notificación.

## 9. Webhook (Teams/Slack)

Configura `NOTIFY_WEBHOOK_URL` y activa `webhookEnabled` en las preferencias.

**Validación:** el endpoint recibe un POST con el título, cuerpo y enlace de la
notificación. Un fallo del webhook no revierte la operación de negocio.

## 10. Entrada de email → request/evento

```powershell
$body = @{
  secret  = $env:EMAIL_INBOUND_SECRET
  from    = 'seguridad@cliente.com'
  to      = 'infosec@board.com'
  subject = 'Solicitud de informe SOC 2'
  text    = 'Necesitamos el informe SOC 2 del último trimestre.'
  clientId = $client.id
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/integrations/email/inbound `
  -ContentType 'application/json' -Headers @{ 'x-inbound-secret'=$env:EMAIL_INBOUND_SECRET } -Body $body
```

**Validación:**
- Sin secreto o con secreto incorrecto → 401.
- Sin `EMAIL_INBOUND_SECRET` configurado → 503 `EMAIL_INBOUND_DISABLED`.
- Con `requestId` → crea un evento `email` de visibilidad `client` en esa request.
- Sin `requestId` → crea una request nueva (`Other Support`) para el cliente.
- Si el remitente no coincide con ningún cliente → 404 `CLIENT_NOT_MATCHED`.

## 11. UI

| Pantalla | Resultado esperado |
|---|---|
| `/` (Kanban) | Tarjetas con prioridad, SLA, cliente, deadline y avatar de owner |
| Filtros/swimlanes | Agrupación por prioridad, owner o SLA |
| `/dashboard` | KPIs, aging, carga por owner y top clientes; clic navega a la request |
| `/clients/:id` | Vista Cliente 360 con pestañas de requests, entregables y CVE |
| Campana de notificaciones | Contador, bandeja, marcar leída / todas |

## 12. Criterio de salida R4

- [ ] El Kanban muestra todos los atributos de negocio.
- [ ] Request y tarea se mantienen sincronizadas sin duplicados.
- [ ] El dashboard global y el Cliente 360 navegan a la request.
- [ ] Una asignación/mención genera notificación in-app y, si está configurado, email.
- [ ] El webhook y el inbound de email son seguros (secreto obligatorio).
