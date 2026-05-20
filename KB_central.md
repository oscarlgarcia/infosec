# Knowledge Center — Plan de Implementación

## Nombre de la funcionalidad: **Knowledge Center**

## Estructura de rutas

```
/knowledge-center
├── (Dashboard)                  → Overview stats + quick actions
├── /reports                     → Lista de reportes guardados (CRUD)
│   ├── /new                     → Generar nuevo reporte por término
│   └── /:id                     → Detalle de reporte guardado (ver/eliminar)
├── /graph                       → Grafo de conocimiento (hereda de Knowledge Graph)
│   └── ?term=SSL                → Grafo filtrado por término
├── /scheduled                   → Reportes programados (CRUD)
│   └── /:id                     → Detalle + historial de snapshots + diff
└── /canonical                   → Respuestas canónicas (CRUD + verify)
```

### Navbar (Layout.tsx) — antes vs después

Antes:
```
📊 Analytics  |  📚 Knowledge Base  |  🧠 Knowledge Graph  |  ⚙️ Settings
```

Después:
```
📊 Analytics  |  📚 Knowledge Base  |  🔬 Knowledge Center  |  ⚙️ Settings
```

## Páginas

| # | Ruta | Página | Archivo |
|---|------|--------|---------|
| 1 | `/knowledge-center` | Dashboard | `KnowledgeCenter.tsx` |
| 2 | `/knowledge-center/reports/new` | Generador de reporte | `TermReportNew.tsx` |
| 3 | `/knowledge-center/reports` | Lista de reportes | `TermReportList.tsx` |
| 4 | `/knowledge-center/reports/:id` | Detalle reporte | `TermReportDetail.tsx` |
| 5 | `/knowledge-center/graph` | Grafo real + `?term=` | `KnowledgeGraph.tsx` (refactor) |
| 6 | `/knowledge-center/scheduled` | CRUD programados | `ScheduledReports.tsx` |
| 7 | `/knowledge-center/scheduled/:id` | Historial snapshots | `ScheduleDetail.tsx` |
| 8 | `/knowledge-center/canonical` | CRUD canónicas | `CanonicalAnswers.tsx` |

## Endpoints Backend

### Reports (report.routes.ts)
| Método | Ruta | Handler |
|--------|------|---------|
| POST | `/reports/generate` | generateTermReport |
| GET | `/reports` | listReports |
| GET | `/reports/:id` | getReport |
| DELETE | `/reports/:id` | deleteReport |
| GET | `/reports/schedules` | listSchedules |
| POST | `/reports/schedules` | createSchedule |
| PUT | `/reports/schedules/:id` | updateSchedule |
| DELETE | `/reports/schedules/:id` | deleteSchedule |
| POST | `/reports/schedules/:id/run-now` | runScheduleNow |
| GET | `/reports/snapshots` | listSnapshots |
| GET | `/reports/snapshots/:id` | getSnapshot |
| GET | `/reports/snapshots/:id/diff/:otherId` | diffSnapshots |

### Canonical Answers (canonical.routes.ts)
| Método | Ruta | Handler |
|--------|------|---------|
| GET | `/canonical-answers` | listCanonical |
| GET | `/canonical-answers/:id` | getCanonical |
| POST | `/canonical-answers` | createCanonical |
| PUT | `/canonical-answers/:id` | updateCanonical |
| DELETE | `/canonical-answers/:id` | deleteCanonical |
| POST | `/canonical-answers/:id/verify` | verifyCanonical |

### Knowledge Graph (modificar existente)
| GET | `/knowledge-graph?term=SSL` | generateTermGraph |
| GET | `/knowledge-graph/stats` | getGraphStats |

## Schemas MongoDB

- **TermReport**: term, definition, directQA[], relatedTopics[], canonicalAnswers[], sourcesUsed[], coverageGaps[], contradictions[], summary, metrics, generatedBy
- **TermReportSchedule**: term, frequency (daily/weekly/monthly), enabled, lastRunAt, nextRunAt, createdBy, notifyOnChanges
- **TermReportSnapshot**: term, scheduleId, report (embedded), metrics, generatedAt

## Archivos nuevos backend

| Archivo | Propósito |
|---------|-----------|
| `src/services/analysis/termReport.service.ts` | Core: generar reporte de término |
| `src/routes/report.routes.ts` | Rutas: reports + schedules + snapshots |
| `src/services/reports/scheduler.ts` | Scheduler: setInterval para ejecutar schedules vencidos |
| `src/services/qa/canonical.service.ts` | CRUD + verify de respuestas canónicas |
| `src/routes/canonical.routes.ts` | Rutas: canonical answers CRUD |

## Archivos nuevos frontend

| Archivo | Propósito |
|---------|-----------|
| `frontend/src/pages/KnowledgeCenter.tsx` | Dashboard principal |
| `frontend/src/pages/TermReportNew.tsx` | Generar nuevo reporte |
| `frontend/src/pages/TermReportList.tsx` | Lista de reportes guardados |
| `frontend/src/pages/TermReportDetail.tsx` | Ver/eliminar reporte guardado |
| `frontend/src/pages/ScheduledReports.tsx` | CRUD de reportes programados |
| `frontend/src/pages/ScheduleDetail.tsx` | Detalle + snapshots + diff |
| `frontend/src/pages/CanonicalAnswers.tsx` | CRUD de respuestas canónicas |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/KnowledgeGraph.tsx` | Refactor: input búsqueda, `?term=`, nodos reales |
| `frontend/src/components/Layout.tsx` | Reemplazar "Knowledge Graph" por "Knowledge Center" con submenú |
| `frontend/src/main.tsx` | Agregar rutas de Knowledge Center |
| `frontend/src/styles/App.css` | Estilos para todas las nuevas páginas |
| `src/services/knowledgeGraph.ts` | Reemplazar mock data por datos reales |
| `src/index.ts` | Arrancar scheduler de reportes |
| `src/routes/index.ts` | Registrar nuevas rutas |
| `src/db/mongo/models.ts` | Agregar nuevos schemas |
