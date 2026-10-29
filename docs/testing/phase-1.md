# Guía de pruebas — Fase R1: Intake 360 + Logbook

> Alcance: campos 360 en `Client`/`ClientRequest`, `RequestEvent` append-only,
> `RequestThread` (máx. 2 niveles), `RequestDocument`, dedupe determinista,
> API de requests/eventos/hilos/documentos, export del logbook y compatibilidad legacy.
>
> Requisitos: backend y frontend arrancados, sesión con rol `admin` o `manager`.

## 1. Pruebas automatizadas

```powershell
npm test
```

Cobertura de esta fase: `tests/status.test.ts` (pipeline completo) y
`tests/serializer.test.ts` (compatibilidad `status`/`statusNew`).

## 2. Alta 360 completa

```powershell
$body = @{
  clientId            = $client.id
  requestType         = 'Customer Agreement Review'
  title               = 'Revisión MSA Q1'
  scope               = 'MSA + DPA'
  priority            = 'P2'
  severity            = 'high'
  requestChannel      = 'email'
  contractType        = 'MSA'
  serviceModel        = 'cloud'
  tags                = @('msa','dpa')
  stakeholders        = @(@{ name='Ana Cliente'; email='ana@cliente.com'; partyType='client'; role='legal' })
  overrideDuplicate   = $true
  comments            = 'Adjunto contrato'
} | ConvertTo-Json -Depth 5

$request = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests `
  -Headers $headers -ContentType 'application/json' -Body $body
$request.requestKey
```

**Validación:**
- `status` = `open` (legacy) y `statusNew` = `new`.
- `slaResponseDueAt` y `slaResolutionDueAt` informados.
- `clientSnapshot` contiene nombre, tipo de cliente y stakeholders.

## 3. Logbook append-only

1. Añade un comentario:

```powershell
$event = @{ type='comment'; visibility='internal'; body='Primera nota interna' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($request.id)/events" `
  -Headers $headers -ContentType 'application/json' -Body $event
```

2. Cambia de estado:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($request.id)/status" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ status='in_analysis'; reason='Asignado a análisis' } | ConvertTo-Json)
```

3. Consulta el logbook:

```powershell
$events = Invoke-RestMethod -Uri "http://localhost:3000/api/requests/$($request.id)/events" -Headers $headers
$events | Select-Object type, authorName, body
```

**Validación:** aparecen los eventos `system` (alta), `comment` y `status_change`, ordenados por fecha, con autor. No existe endpoint para editar/borrar eventos: una corrección es un evento nuevo.

## 4. Hilos y sub-hilos

```powershell
$thread = @{ type='questionnaire'; title='Cuestionario de seguridad' } | ConvertTo-Json
$root = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($request.id)/threads" `
  -Headers $headers -ContentType 'application/json' -Body $thread

$child = @{ type='questionnaire'; title='Sección Anexo A'; parentThreadId=$root.id } | ConvertTo-Json
$sub = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($request.id)/threads" `
  -Headers $headers -ContentType 'application/json' -Body $child
```

**Validación:**
- El sub-hilo se crea con `parentThreadId`.
- Intentar crear un tercer nivel devuelve `400` (máximo 2 niveles).
- Cerrar el hilo genera evento `thread_closed`.

## 5. Documentos y dedupe

```powershell
# Sube el mismo archivo dos veces
curl.exe -X POST "http://localhost:3000/api/requests/$($request.id)/documents" `
  -H "Authorization: Bearer $token" -F "files=@docs/testing/fixtures/a.pdf"
curl.exe -X POST "http://localhost:3000/api/requests/$($request.id)/documents" `
  -H "Authorization: Bearer $token" -F "files=@docs/testing/fixtures/a.pdf"
```

**Validación:**
- La segunda subida devuelve `duplicates` con el `documentId` existente.
- `GET /api/requests/:id/documents` no expone `storageKey`.
- `GET /api/requests/:id/documents/:documentId/download` sin token → 401.

## 6. Dedupe determinista

Crea dos requests con el mismo cliente, tipo y alcance:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ clientId=$client.id; requestType='InfoSec Support'; scope='Revisión de firewall' } | ConvertTo-Json)
```

**Validación:** segunda llamada → `409` con `error.code = POSSIBLE_DUPLICATE` y
`error.duplicates`. Repetir con `overrideDuplicate=true` → `201`.

## 7. Export del logbook

```powershell
Invoke-WebRequest "http://localhost:3000/api/requests/$($request.id)/logbook.md" -Headers $headers | Select-Object -ExpandProperty Content
Invoke-WebRequest "http://localhost:3000/api/requests/$($request.id)/logbook.html" -Headers $headers | Select-Object -ExpandProperty Content
```

**Validación:** el Markdown incluye cabecera, estado, SLA y todos los eventos;
el HTML se puede imprimir a PDF desde el navegador. `logbook.pdf` devuelve `501`
(no implementado, decisión conocida).

## 8. UI

| Paso | Resultado esperado |
|---|---|
| `/requests` | Tabla con clave, cliente, estado, prioridad, SLA y deadline |
| Filtro por estado | Solo aparecen las requests del estado elegido |
| `/requests/new` | Wizard de 3 pasos; adjuntos se envían de verdad |
| `/requests/:id` | Cabecera, timeline, composer, panel de hilos y documentos |
| Cambio de idioma | Textos ES/EN sin recargar |

## 9. Compatibilidad legacy

```powershell
Invoke-RestMethod "http://localhost:3000/api/clients/$($client.id)/requests" -Headers $headers
```

**Validación:** la respuesta mantiene `status` legacy (`open|in_progress|completed`)
y añade `statusNew`; los adjuntos embebidos antiguos siguen visibles.

## 10. Criterio de salida R1

- [ ] Toda mutación deja un `RequestEvent` con autor y fecha.
- [ ] Hilos limitados a 2 niveles.
- [ ] Documentos con checksum, versión y descarga autenticada.
- [ ] Duplicados detectados con `409` y posibilidad de override.
- [ ] Logbook exportable en Markdown y HTML imprimible.
- [ ] Alta con adjuntos desde el wizard.
