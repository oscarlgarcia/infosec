# Guía de pruebas — Fase R0: Saneamiento y cimientos

> Alcance: modelos base de Request 360, numeración atómica, serializer,
> descargas autenticadas, multipart multi-archivo, esquemas zod y convención `/api`.
>
> Requisitos previos: `npm install`, `.env` con `JWT_SECRET` y `JWT_REFRESH_SECRET`
> (mínimo 32 caracteres), MongoDB disponible (`MONGODB_URI`).

## 1. Pruebas automatizadas

```powershell
npm run typecheck
npm test
```

| Test | Archivo | Qué valida |
|---|---|---|
| Formato de clave | `tests/numbering.test.ts` | `REQ-<año>-<6 dígitos>`, parseo y round-trip |
| Pipeline de estados | `tests/status.test.ts` | estados confirmados, mapeo legacy y transiciones |
| Fechas laborables | `tests/sla.test.ts` | fines de semana, festivos, horario custom, `addSlaTime` |
| Serializer | `tests/serializer.test.ts` | `status` + `statusNew`, defaults, documento sin `storageKey` |

Resultado esperado: **38+ tests en verde**.

## 2. Numeración atómica (manual, requiere MongoDB)

1. Arranca el backend: `npm run dev`.
2. Autentícate y guarda el token:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login `
  -ContentType 'application/json' `
  -Body (@{ username='admin'; password='<password>' } | ConvertTo-Json)
$token = $login.accessToken
$headers = @{ Authorization = "Bearer $token" }
```

3. Crea dos clientes y lanza 20 altas en paralelo:

```powershell
$client = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/clients `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ name="R0 Test $(Get-Random)"; clientType='Cloud' } | ConvertTo-Json)

$jobs = 1..20 | ForEach-Object {
  Start-ThreadJob -ScriptBlock {
    param($h, $cid)
    Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests `
      -Headers $h -ContentType 'application/json' `
      -Body (@{ clientId=$cid; requestType='InfoSec Support'; overrideDuplicate=$true } | ConvertTo-Json)
  } -ArgumentList $headers, $client.id
}
$keys = ($jobs | Wait-Job | Receive-Job).requestKey
$keys | Sort-Object -Unique | Measure-Object
```

**Validación:** 20 claves únicas con el patrón `REQ-\d{4}-\d{6}`. El contador `Counter` no retrocede ni duplica.

## 3. Descargas autenticadas y path traversal

```powershell
# Sin token → 401
Invoke-WebRequest http://localhost:3000/api/uploads/clients/cualquier.pdf

# Con token y nombre malicioso → 404, nunca sale de uploads/clients
Invoke-WebRequest http://localhost:3000/api/uploads/clients/..%2f..%2f.env -Headers $headers
```

**Validación:** la primera llamada devuelve `401`; la segunda `404` y el `.env` no se sirve.

## 4. Multipart multi-archivo en el alta

```powershell
curl.exe -X POST http://localhost:3000/api/requests `
  -H "Authorization: Bearer $token" `
  -F "payload={""clientId"":""<id>"",""requestType"":""InfoSec Support"",""overrideDuplicate"":true}" `
  -F "files=@docs/testing/fixtures/a.pdf" `
  -F "files=@docs/testing/fixtures/b.png"
```

**Validación:** la respuesta incluye `documents` con 2 elementos y el caso 360
(`GET /api/requests/:id/360`) los lista en `documents`.

> Para generar fixtures: `New-Item docs/testing/fixtures -ItemType Directory` y
> copia dos archivos pequeños (< 1 MB).

## 5. Validación de esquemas

```powershell
# Body inválido → 400 con details
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/requests `
  -Headers $headers -ContentType 'application/json' -Body '{"requestType":"InfoSec Support"}'
```

**Validación:** `400`, `error.code` de validación y `error.details` indicando `clientId` requerido.

## 6. Convención de rutas

Comprueba que las rutas nuevas viven bajo `/api`:

| Ruta | Esperado |
|---|---|
| `GET /api/requests` | 200 (lista paginada) |
| `GET /requests` (sin prefijo) | 404 |
| `GET /api/dashboard/global` | 200 |

## 7. Criterio de salida R0

- [ ] `npm run typecheck` sin errores.
- [ ] `npm test` en verde.
- [ ] 20 altas concurrentes → 20 claves únicas.
- [ ] Descarga sin token → 401; path traversal → 404.
- [ ] Alta con 2 archivos → 2 `RequestDocument`.
- [ ] Body inválido → 400 con `details`.
