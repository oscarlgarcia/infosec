# Cambios

## 2026-04-16

- `Hero /app texto encima + botones oscuros` Ajuste de lectura y acción sobre banner
  - `frontend/src/pages/SmeManagerHome.tsx`: se añade de nuevo contenido textual encima del banner y CTAs de navegación (`/chat`, `/knowledge-base`).
  - `frontend/src/styles/App.css`: nuevos estilos `sme-hero-content-overlay*` para posicionar el texto sobre la imagen y botones en tonos oscuros con contraste alto.
  - Validación: build frontend en Docker y redeploy `docker compose up -d --build frontend`.

- `Hero /app con board_trazos` Reemplazo de imagen y padding blanco izquierdo sin reescalar
  - `frontend/src/assets/images/board-confluence-hero.png`: sustituido por composición basada en `board_trazos.png` manteniendo tamaño original del arte (704x668) y completando a la izquierda con fondo blanco en un lienzo 1250x668.
  - `frontend/src/pages/SmeManagerHome.tsx`: el hero ahora renderiza la imagen como `<img>` para evitar reescalado del asset.
  - `frontend/src/styles/App.css`: `sme-hero-bg` y `sme-hero-bg-image` ajustados para mostrar el banner en tamaño fijo sin distorsión.
  - Validación: `docker compose exec -T frontend npm run build` y redeploy `docker compose up -d --build frontend`.

- `Hero /app con imagen corporativa` Sustitución de fondo y simplificación visual en SME/Manager
  - `frontend/src/pages/SmeManagerHome.tsx`: el hero de `/app` (rol `sme/manager`) ahora usa exclusivamente la imagen compartida como fondo y elimina todos los textos/bloques de la izquierda.
  - `frontend/src/assets/images/board-confluence-hero.png`: nuevo asset incorporado desde `BOAR_CONFLUENCE_LOGO.png` para fondo de hero.
  - `frontend/src/styles/App.css`: nuevo estilo `sme-hero-bg` para mostrar el banner con ajuste responsive y mantener borde/sombra consistentes.
  - Verificación ejecutada: `docker compose exec -T frontend npm run build` y redeploy con `docker compose up -d --build frontend`.

## 2026-04-15

- `Hero /app SME-Manager (futurista)` Rediseño visual con fondo de imagen y overlay legible
  - `frontend/src/pages/SmeManagerHome.tsx`: hero renovado para `sme/manager` con copy bilingüe ES/EN, dos CTAs (`/chat`, `/knowledge-base`) y cards de contexto operativo.
  - `frontend/src/styles/App.css`: nueva capa visual `sme-hero*` con imagen de fondo, overlay gradiente oscuro para contraste AA, estilos responsive (desktop/tablet/mobile) y botones con jerarquía visual.
  - `frontend/src/assets/images/infosec-hero-futuristic.png`: nuevo asset raster para el hero (estética InfoSec futurista tipo SOC).
  - Build validado en frontend dentro de Docker y despliegue actualizado con `docker compose up -d --build frontend`.

- `Sprint V3 (completado en un batch)` Backlog extendido de plataforma InfoSec AI
  - **Chat productivo sobre RAG**:
    - `src/services/chat/chat.ts`: el chat conversacional ya usa `runChatQuery` por defecto (sesión = conversación), mantiene fallback al agente legacy y adjunta fuentes/flags cuando existen.
    - `src/routes/index.ts`: `/conversations/:id/chat` ahora propaga `requestId` y `userId` al pipeline para trazabilidad completa.
  - **OpenAI-native ingestion (vector stores)**:
    - `src/services/llm/openai.ts`: nueva subida de archivos a OpenAI (`files.create`) y asociación a `vectorStores.files.create`.
    - `src/services/ingestion/ingestion.ts`: ingestión documental guarda `openaiFileId` y `vectorStoreIds` en metadata cuando está habilitado.
    - `src/config/index.ts`: flag nuevo `OPENAI_INGEST_TO_VECTOR_STORES`.
    - `src/db/mongo/models.ts`: metadata documental ampliada con campos OpenAI.
  - **Batch & jobs (Answer Builder v2)**:
    - `src/services/jobs/queue.ts`: cola asíncrona central para trabajos largos.
    - `src/services/answer-builder/parser.ts`: parser de cuestionarios (`csv/xlsx/xls/docx/txt`) con deduplicación.
    - `src/services/answer-builder/jobs.ts`: ejecución en cola + estado de cola expuesto.
    - Nuevas APIs:
      - `POST /answer-builder/upload` (fichero -> preguntas -> job),
      - `GET /answer-builder/queue`,
      - `GET /answer-builder/jobs/:id/export.csv`.
  - **Analytics avanzada y gobierno operativo**:
    - `src/services/analytics/analytics.ts`: 
      - `question-clusters`,
      - `opportunity scoring`,
      - métricas ampliadas para cobertura priorizada.
    - Nuevas APIs:
      - `GET /analytics/question-clusters`,
      - `GET /analytics/opportunities`.
  - **Operaciones/SRE básicas in-app**:
    - `src/services/ops/maintenance.ts`: recalculo de frescura documental y política de retención.
    - Nuevas APIs admin:
      - `POST /ops/freshness-refresh`,
      - `POST /ops/retention`.
  - **Frontend funcional nuevo**:
    - `frontend/src/pages/AnswerBuilder.tsx`: flujo end-to-end para subir cuestionario, lanzar job, ver estado y descargar CSV.
    - `frontend/src/pages/AnalyticsDashboard.tsx`: nuevas secciones de `question clusters` y `opportunity scoring`.
    - `frontend/src/main.tsx` + `frontend/src/components/Layout.tsx`: rutas y navegación para `Answer Builder`.
  - **Validación en Docker**:
    - `docker compose exec -T backend npm run typecheck` ✅
    - `docker compose exec -T frontend npm run build` ✅
    - `docker compose up -d --build` ✅
    - Smoke tests API ✅:
      - `/analytics/question-clusters`,
      - `/analytics/opportunities`,
      - `/ops/freshness-refresh`,
      - `/ops/retention`,
      - `/conversations/:id/chat` con `responseId`,
      - `/answer-builder/upload` + polling + `/export.csv`.

- `Sprint V2 (3 sprints ejecutados en un release)` Plataforma InfoSec AI v2 visible y operativa
  - **Sprint 1 (Core RAG + hardening)**:
    - `src/index.ts`: contrato de errores uniforme (`error.code`, `error.message`, `error.request_id`) y `not_found` estandarizado.
    - `src/services/rag/orchestrator.ts`: score de cobertura y confianza ahora penaliza contradicciones + evidencia obsoleta (`contradictionPenalty`, `stalenessPenalty`), añadiendo flags `contradiction` y `stale_evidence`.
    - `src/services/rag/contradictions.ts`: detector de contradicciones v1 (canónica vs Q&A y stale docs) reutilizable por API y pipeline.
  - **Sprint 2 (Gobierno + analytics + batch)**:
    - `POST /responses/:id/feedback`: captura decisión humana (`accepted|edited|discarded|copied|exported`) y la persiste en `ResponseTrace` + `AnalyticsEvent`.
    - `GET /analytics/client-overview`: drill-down por cliente (queries, sesiones, confianza, tasas legal/contradicción).
    - `GET /analytics/freshness|recommendations|trends` ampliados para recomendaciones accionables y monitor de frescura.
    - `Answer Builder`: ejecución asíncrona real por job y export CSV (`GET /answer-builder/jobs/:id/export.csv`).
  - **Sprint 3 (UX/visibilidad en frontend)**:
    - Nueva ruta/página `/contradictions` con analizador interactivo y tabla de hallazgos.
    - `Layout` actualizado para mostrar acceso directo a contradicciones en el menú.
    - `Analytics Dashboard` ampliado con métricas de feedback (accepted/edited/discarded/copy/export) y bloque de drill-down por cliente.
  - **Validación en Docker**:
    - `docker compose exec -T backend npm run typecheck` ✅
    - `docker compose exec -T frontend npm run build` ✅
    - `docker compose up -d --build` ✅ (backend en `:3001`, frontend en `:5174`)
    - Smoke API ✅: `/analytics/freshness`, `/analytics/client-overview`, `/analysis/contradictions`, `/responses/:id/feedback`, `/answer-builder/jobs/:id/export.csv`.

- `bdc668e` Plataforma RAG v1 + paneles operativos
  - Backend: nuevo orquestador `POST /chat/query` con pipeline (intent, retrieval, contexto, generacion, persistencia), trazas por respuesta (`/responses/:id/trace`) y resumen de sesion incremental.
  - Gobierno/ingestion: nuevos endpoints `/ingestion/*`, CRUD de reglas (`/rules`), workflow de candidatos KB (`/kb/candidates/:id/approve|reject`) y versionado de respuestas canonicas con aprobacion humana.
  - Batch/analytics: jobs de Answer Builder (`/answer-builder/jobs`) y dashboards API (`/analytics/overview`, `/analytics/coverage-gaps`, `/analytics/quality`) con eventos, cobertura y backlog de gaps.
  - Frontend: nuevas vistas protegidas para `admin/manager/sme`:
    - `/analytics` (cards KPI, dominios top, cobertura y top gaps),
    - `/kb-candidates` (revision y aprobacion/rechazo de candidatos).
  - Compatibilidad: configuracion OpenAI extendida (`OPENAI_BASE_URL`, `OPENAI_USE_RESPONSES`, `OPENAI_VECTOR_STORE_IDS`) y fallback local/Ollama cuando no hay credenciales reales.
- `commit_actual` Documentacion de release
  - Se normaliza `cambios.md` para registrar el hash real del release y mantener trazabilidad historica por commit.
- `479df1a` Alta de clientes (Chat) + navegación en header
  - Backend: `sme` puede crear/listar/editar/borrar clientes y subir adjuntos (`/clients`, `/clients/:id/attachments`).
  - Frontend: si falla crear cliente/adjuntos, el error se propaga y el modal no se cierra; se muestra mensaje de error.
  - UI: links principales pasan de sidebar fijo a drawer “☰” en el header; se eliminan los links placeholder `/option/1..7`.
- `dce38d1` Documentación: se añade `cambios.md` para registrar cambios por commit.
- `db65fc9` Documentación: se amplía el detalle del changelog para que sea operativo (qué cambia y dónde impacta).
