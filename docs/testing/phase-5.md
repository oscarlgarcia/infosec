# Guía de pruebas — Fase R5: ingesta NVD + CISA KEV y matching de inventario

> Alcance: catálogo normalizado `CveRecord`, estado de sincronización
> `CveSyncState`, clientes NVD API 2.0 y CISA KEV, mapeadores puros, matcher
> CPE/versión/nombre/etiquetas, promoción idempotente a `CveAdvisory`, inventario
> tecnológico por cliente y UI de catálogo, detalle, sincronización e inventario.
>
> Requisitos: R0–R4 completos y contenedor backend recreado para cargar las
> nuevas variables de `.env`.

## 0. Configuración

Variables nuevas (ver `.env.example`):

```dotenv
NVD_API_KEY=                      # opcional; sin clave el límite es 5 req/30 s
NVD_API_BASE_URL=https://services.nvd.nist.gov/rest/json/cves/2.0
NVD_SYNC_ENABLED=true
NVD_SYNC_INTERVAL_MS=7200000       # cada 2 h
NVD_BACKFILL_START=2026-01-01      # solo se ingesta desde 2026
NVD_INGEST_REJECTED=false
NVD_REQUEST_TIMEOUT_MS=90000
KEV_FEED_URL=https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
KEV_SYNC_ENABLED=true
KEV_SYNC_INTERVAL_MS=21600000      # cada 6 h
CVE_MATCHER_ENABLED=true
CVE_SYNC_START_DELAY_MS=60000      # primera ejecución tras arrancar
```

`docker compose restart` **no** relee `env_file`; hay que recrear el contenedor:

```powershell
docker compose up -d --force-recreate backend
docker compose logs -f backend | Select-String "\[CVE\]"
```

**Validación:** el log muestra `[CVE] Sync scheduler started (NVD on, KEV on)` y,
tras el retraso inicial, una línea de sincronización por fuente.

## 1. Pruebas automatizadas

```powershell
npm test
```

Cobertura R5 (`tests/cve.test.ts`): normalización de severidad y CVSS, parseo de
CPE 2.2/2.3, extracción de CPEs vulnerables, mapeo NVD/KEV, fechas UTC sin
zona horaria, división de ventanas de 120 días, construcción de queries NVD,
límites de rate, comparación de versiones, rangos CPE y reglas de matching
(CPE + versión, nombre, etiquetas, nombres genéricos).

## 2. Estado de sincronización

```powershell
$headers = @{ Authorization = "Bearer $env:TOKEN" }
$status = Invoke-RestMethod "http://localhost:3001/api/cve-sync/status" -Headers $headers
$status | ConvertTo-Json -Depth 6
```

**Validación:**
- `states` contiene `nvd` y `kev` con `status`, `mode`, `cursorFrom`, `cursorTo`,
  `lastSuccessAt`, `progress` y `stats`.
- `catalog` devuelve contadores de `records`, `kevListed`, `advisories` y `matched`.
- `config` refleja los intervalos y el inicio de backfill.
- Solo `admin`, `manager` y `sme` pueden consultar el estado.

## 3. Sincronización manual

Los disparos manuales responden `202 { started: true }` y se ejecutan en segundo
plano. Consulta `/cve-sync/status` para seguir el progreso.

```powershell
# NVD: modo automático (usa el cursor persistido)
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cve-sync/nvd" `
  -Headers $headers -ContentType 'application/json' -Body '{}'

# NVD: forzar backfill desde una fecha
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cve-sync/nvd" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ mode='backfill'; from='2026-01-01' } | ConvertTo-Json)

# KEV: sincroniza solo si cambió la versión del catálogo
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cve-sync/kev" `
  -Headers $headers -ContentType 'application/json' -Body '{}'

# KEV: forzar aunque no cambie la versión
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cve-sync/kev" `
  -Headers $headers -ContentType 'application/json' -Body (@{ force=$true } | ConvertTo-Json)
```

**Validación:**
- Un segundo disparo mientras corre devuelve `409` (lock en proceso + `lockedAt`).
- El backfill se divide en ventanas de como máximo 120 días y avanza `cursorTo`
  solo al completar cada ventana.
- `mode` permanece `backfill` hasta terminar y después pasa a `incremental`.
- KEV sin cambios responde `skipped: true` y no reescribe registros.
- Los CVEs `Rejected` se omiten con `NVD_INGEST_REJECTED=false`.

## 4. Catálogo

```powershell
# Búsqueda y filtros
Invoke-RestMethod "http://localhost:3001/api/cve-catalog?q=exchange&severity=critical&kev=true&page=1&limit=25" -Headers $headers

# Solo CVEs que afectan a un cliente
Invoke-RestMethod "http://localhost:3001/api/cve-catalog?matchedClientId=$($client.id)" -Headers $headers

# Detalle por CVE ID o por _id
Invoke-RestMethod "http://localhost:3001/api/cve-catalog/CVE-2026-12345" -Headers $headers
```

**Validación:**
- La lista admite `q`, `severity`, `kev`, `ransomware`, `vendor`, `product`,
  `hasAdvisory`, `matchedClientId`, `publishedFrom`, `publishedTo`, `sort`,
  `page` y `limit` (máximo 100).
- `sort=cvss` ordena por CVSS descendente y `sort=kev` prioriza KEV.
- El detalle incluye `cpes`, `references`, `kev`, `matches` pobladas con
  `name/clientType/country/customerStatus`, y el aviso/impactos si existen.
- Un CVE inexistente devuelve `404`.

## 5. Inventario tecnológico del cliente

```powershell
$items = @(
  @{ vendor='Microsoft'; product='Exchange Server'; version='2019'; criticality='critical' },
  @{ vendor='Apache';    product='Log4j';           version='2.14.1'; criticality='high' }
) | ConvertTo-Json

Invoke-RestMethod -Method Put -Uri "http://localhost:3001/api/clients/$($client.id)/technology-inventory" `
  -Headers $headers -ContentType 'application/json' -Body (@{ items = ($items | ConvertFrom-Json) } | ConvertTo-Json -Depth 5)

Invoke-RestMethod "http://localhost:3001/api/clients/$($client.id)/technology-inventory" -Headers $headers

# Recalcular coincidencias de un cliente concreto
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/clients/$($client.id)/technology-inventory/rematch" -Headers $headers
```

**Validación:**
- El `PUT` guarda el inventario y lanza un rematch en segundo plano
  (`rematchStarted: true`).
- El rematch devuelve `{ clientId, scanned, changed }` y actualiza
  `CveRecord.matches`.
- Un cliente inexistente devuelve `404`.

## 6. Reglas de matching

| Caso | Resultado esperado |
|---|---|
| CPE vendor/product coincide y la versión está dentro del rango | `confidence ≈ 0.98`, motivo "within affected range" |
| CPE coincide pero la versión queda fuera del rango | Sin coincidencia (la versión es autoritativa, no hay fallback por nombre) |
| CPE coincide y no hay versión en el inventario | Coincidencia con `confidence 0.85` |
| Sin CPE, nombre de producto significativo coincide | `confidence` entre 0.5 y 0.9 |
| Solo tokens genéricos (`windows`, `server`, `client`…) | Sin coincidencia por nombre |
| Etiqueta del cliente (`tags`) coincide con vendor/product | `confidence 0.5` |

Umbral mínimo persistido: `MATCH_THRESHOLD = 0.5`. Los resultados se guardan en
`CveRecord.matches` como `{ clientId, confidence, reasons[], matchedVendor,
matchedProduct, matchedVersion }`.

## 7. Promoción a aviso

```powershell
# Idempotente: devuelve created=false si ya existía
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cve-catalog/CVE-2026-12345/promote" -Headers $headers
```

**Validación:**
- Crea un `CveAdvisory` en `draft`/`unknown` enlazado por `cveRecordId`.
- Materializa un `CveImpact` por cada coincidencia con `affected: false`,
  `posture: 'under_review'` y `rationale` prefijado `Auto-matched`.
- **No** crea avisos, impactos ni correos de forma automática durante la ingesta.
- Una segunda promoción no duplica aviso ni impactos (`created: false`).
- Un CVE inexistente devuelve `404`.

## 8. Recálculo de coincidencias de un CVE

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cve-catalog/CVE-2026-12345/match" -Headers $headers
```

**Validación:** devuelve `{ items: [...] }` ordenados por confianza y actualiza
`CveRecord.matches` sin tocar avisos ni impactos existentes.

## 9. UI

| Pantalla | Resultado esperado |
|---|---|
| `/cve` → pestaña Catálogo | Búsqueda, severidad, aviso, orden, KEV y ransomware; badges KEV/Ransomware/Clientes/Advisory |
| `/cve` → pestaña Avisos curados | Listado de avisos con creación manual y filtros existentes |
| `/cve/:cveId` | Bloques NVD/KEV (CVSS, vector, CWE, CPEs, referencias), coincidencias de clientes y botón "Crear aviso" |
| `/cve/:id` (aviso) | Datos editables del aviso, impactos, borrador IA y enlace a la ficha de origen |
| `/cve-sync` (admin) | KPIs, estado por fuente, progreso, errores y disparos manuales NVD/KEV |
| `/clients/:id` → Inventario tecnológico | Alta/edición/borrado de elementos, guardado y recálculo |

**Validación:**
- Toda la UI respeta ES/EN y usa clases `r360-*`.
- Los CVEs sincronizados aparecen solo en el catálogo hasta que un usuario los
  promueve.
- El aviso promovido enlaza de vuelta a la ficha NVD/KEV.

## 10. Criterio de salida R5

- [ ] NVD y KEV se sincronizan según los intervalos configurados y el backfill.
- [ ] El catálogo se puede filtrar y consultar en detalle con datos de origen.
- [ ] El inventario tecnológico por cliente persiste y recalcula coincidencias.
- [ ] Las coincidencias explican confianza y motivos, sin falsos positivos de versión.
- [ ] La promoción a aviso es idempotente y no dispara comunicación automática.
- [ ] La UI cubre catálogo, detalle, sincronización e inventario en ES/EN.
