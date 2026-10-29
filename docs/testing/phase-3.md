# Guía de pruebas — Fase R3: Consultas rápidas + CVE + IA

> Alcance: `requestKind = quick_query` con SLA corto y promoción a estándar,
> `CveAdvisory`/`CveImpact`, suscripciones CVE, vista transversal de impacto,
> borradores de comunicación, `requestAi.service` y `AiArtifact`.
>
> Requisitos: R0–R2 completos; `OPENAI_API_KEY` válida o proveedor LLM configurado.

## 1. Pruebas automatizadas

```powershell
npm test
```

Cobertura relacionada: pipeline de estados (`in_analysis → working → delivered`)
y detección de duplicados determinista (`similarityScore`).

## 2. Consulta rápida

```powershell
$quick = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{
    clientId=$client.id
    requestType='InfoSec Support'
    requestKind='quick_query'
    title='¿Tenéis SOC 2?'
    overrideDuplicate=$true
  } | ConvertTo-Json)
```

**Validación:**
- Se crea con `requestKind = quick_query` y `request` visible en la bandeja.
- **No** se crea tarjeta Kanban (`createKanbanTaskForRequest` se omite para quick query).
- El SLA de respuesta es el corto definido por la política de quick query.

### Promoción a request estándar

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($quick.id)/promote" -Headers $headers
```

**Validación:** la request pasa a `requestKind = standard`, se le asigna la
numeración/SLA estándar y se registra un evento de sistema con el motivo.

## 3. CVE — alta y consulta

```powershell
$cve = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/cve-advisories `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{
    cveId='CVE-2026-99999'
    title='Vulnerabilidad crítica en OpenSSL'
    severity='critical'
    cvssScore=9.8
    products=@('OpenSSL 3.0')
    summary='Desbordamiento de buffer en TLS handshake'
    posture='under_review'
    status='published'
  } | ConvertTo-Json)
```

**Validación:**
- `GET /api/cve-advisories` lista el advisory y permite filtrar por severidad/estado/texto.
- `GET /api/cve-advisories/CVE-2026-99999` funciona igual que por `_id`.
- Severidad `critical` ordena antes que `high` en la vista transversal.

## 4. Impacto por cliente

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cve-advisories/$($cve.id)/impacts" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{
    clientId=$client.id
    posture='affected'
    affected=$true
    rationale='Usa OpenSSL 3.0 en el balanceador'
    communicate=$true
  } | ConvertTo-Json)
```

**Validación:**
- `GET /api/cve-advisories/:id/impacts` muestra todos los clientes afectados.
- `GET /api/cve-impacts` es la vista transversal (filtrable por cliente/severidad).
- Si `communicate = true`, se crea un borrador de comunicación y se registra
  evento `cve_impact` en el logbook de la request asociada (si se indicó `requestId`).

## 5. Suscripciones CVE por cliente

```powershell
Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/clients/$($client.id)/cve-subscriptions" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ enabled=$true; minSeverity='high'; emails=@('seguridad@cliente.com') } | ConvertTo-Json)

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cve-advisories/$($cve.id)/notify" -Headers $headers
```

**Validación:** solo reciben aviso los clientes suscritos cuyo umbral de severidad
se cumple. La notificación queda en la bandeja y, si SMTP está configurado, se envía email.

## 6. Borrador de comunicación CVE

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cve-advisories/$($cve.id)/draft" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ clientId=$client.id; tone='formal' } | ConvertTo-Json)
```

**Validación:** devuelve un `AiArtifact` de tipo borrador, editable, con citas o
referencias a la KB. Nunca se envía automáticamente al cliente.

## 7. IA — resumen de caso

```powershell
$summary = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($req.id)/ai/summary" `
  -Headers $headers -ContentType 'application/json' -Body '{}'

$summary.kind        # summary
$summary.status      # draft
```

**Validación:**
- El resumen **excluye** eventos/documentos con visibilidad `internal`.
- Queda en estado `draft`; no modifica la request ni el logbook público.
- `GET /api/requests/:id/ai/artifacts` lista los artefactos.

## 8. IA — follow-up y acta

```powershell
# Borrador de follow-up con instrucciones
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($req.id)/ai/followup-draft" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ instructions='Tono cercano, recordar el DPA pendiente' } | ConvertTo-Json)

# Acta de reunión
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/requests/$($req.id)/ai/meeting-minutes" `
  -Headers $headers -ContentType 'application/json' -Body '{}'
```

**Validación:** ambos generan `AiArtifact` editables con `citations`/`flags`.
No se publican sin aceptación explícita.

## 9. Aceptar / editar / descartar artefactos

```powershell
# Aceptar con edición
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/ai-artifacts/$($summary.id)/accept" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ editedContent='Resumen revisado por el analista' } | ConvertTo-Json)

# Descartar
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/ai-artifacts/$($artifact.id)/discard" -Headers $headers
```

**Validación:**
- Aceptar crea un evento `ai_draft` con el contenido final y autor humano.
- Descartar deja el artefacto en `discarded` y no toca el logbook.
- Ningún contenido `internal` aparece en artefactos marcados como visibles al cliente.

## 10. Clasificador de intake y dedupe semántico

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests/intake/classify `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ text='Necesitamos el informe SOC 2 y el certificado ISO 27001' } | ConvertTo-Json)

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests/check-duplicates `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ clientId=$client.id; requestType='InfoSec Support'; title='Informe SOC 2' } | ConvertTo-Json)
```

**Validación:** el clasificador propone `requestType`, prioridad y adjuntos
esperados; el dedupe semántico consulta la colección Chroma `requests` y devuelve
candidatos con score. Ambos son **sugerencias**, nunca bloquean el alta.

## 11. UI

| Pantalla | Resultado esperado |
|---|---|
| `/requests/new` | Modo consulta rápida y clasificador de intake |
| `/cve` | Lista de advisories con filtros y severidad |
| `/cve/:id` | Detalle, impactos por cliente y borrador de comunicación |
| `/requests/:id` | Panel IA con resumen, follow-up, acta y aceptar/descartar |

## 12. Criterio de salida R3

- [ ] La consulta rápida no genera Kanban y se puede promover.
- [ ] Un CVE muestra todos los clientes afectados.
- [ ] Las suscripciones respetan el umbral de severidad.
- [ ] Los borradores IA citan fuentes y quedan como `draft`.
- [ ] Aceptar/descartar artefactos deja traza en el logbook.
