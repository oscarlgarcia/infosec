# CMS Module — Propuestas de mejora

## Estado actual

**Backend:** 26 endpoints (categorías, tags, páginas, versiones, búsqueda semántica, bookmarks, recientes, FAQs, destacados, populares). Servicio en `src/services/cms/cms.ts` (316 líneas).

**Frontend:** Página única `CMS.tsx` (1062 líneas) con pestañas: Pages, Categories, Bookmarks, Recent, Search. Editor rich-text basado en TipTap con toolbar completa (sin imágenes, sin tablas).

**Integración RAG:** Las páginas publicadas se indexan en ChromaDB (`infosec-cms`) y se recuperan junto con documentos, Q&A y FAQs en las respuestas del chat.

---

## Top 10 mejoras (ordenadas por utilidad × facilidad)

### 1. 🖼️ Subida de imágenes en el editor (RTE)

**Utilidad: Alta · Esfuerzo: Medio**

- El editor rich-text (TipTap) no tiene soporte para imágenes
- Crear endpoint `POST /cms/upload` → guarda en `uploads/cms/`
- Extender la toolbar de TipTap con botón de imagen (subida + inserción `<img>`)
- Impacto enorme: guías InfoSec con capturas, diagramas, logos

**Archivos a modificar:**
- `src/routes/index.ts` — nuevo endpoint POST /cms/upload
- `src/services/cms/cms.ts` — función handleUpload
- `frontend/src/pages/CMS.tsx` — extensión TipTap Image extension
- Modelo de uploads existente (reusar patrón de uploads de knowledge)

---

### 2. 📄 Paginación en lista de páginas

**Utilidad: Alta · Esfuerzo: Bajo**

- Hoy `getAllContentPages()` retorna **todas** las páginas sin `skip`/`limit`
- Modificar backend: aceptar `?page=&pageSize=`
- Frontend: breadcrumbs de paginación abajo de la lista
- Crítico a mediano plazo cuando el CMS crezca

**Archivos a modificar:**
- `src/services/cms/cms.ts` — add page/pageSize params a getAllContentPages
- `src/routes/index.ts` — pasar query params
- `frontend/src/pages/CMS.tsx` — botones de paginación

---

### 3. 🏷️ UI de gestión de Tags

**Utilidad: Alta · Esfuerzo: Bajo**

- Tags existen en backend (`POST/GET/DELETE /cms/tags`) pero **no hay UI**
- Añadir sección de tags (crear con nombre+color, listar, eliminar)
- En el formulario de página: multi-select de tags (hoy el campo `tags` ni siquiera se renderiza)
- Bajo esfuerzo, cierra un gap importante

**Archivos a modificar:**
- `frontend/src/pages/CMS.tsx` — nueva sub-pestaña Tags o modal + multi-select en form

---

### 4. 🌳 Visualización jerárquica de categorías

**Utilidad: Media · Esfuerzo: Bajo**

- Schema soporta `parentId` (categorías anidadas) pero la UI muestra lista plana
- Renderizar árbol indentado en la pestaña de categorías
- Al seleccionar página, mostrar ruta completa (ej: `Políticas > Seguridad > Acceso`)
- Sin cambios en backend, solo frontend

**Archivos a modificar:**
- `frontend/src/pages/CMS.tsx` — render recursivo de categorías con indentación

---

### 5. 🔗 UI de contenido relacionado

**Utilidad: Media · Esfuerzo: Bajo**

- Schema tiene `relatedContent: [ObjectId]` y backend lo popula, pero **no hay UI** para gestionarlo
- En formulario de edición: multi-select de otras páginas CMS
- En vista de página: mostrar tarjetas con enlaces a relacionadas
- Backend ya soporta todo, solo frontend

**Archivos a modificar:**
- `frontend/src/pages/CMS.tsx` — multi-select en form + tarjetas en view

---

### 6. 📋 Duplicar página

**Utilidad: Media · Esfuerzo: Bajo**

- Botón "Duplicar" en la vista de página
- Crea copia con título "Copia de X", status `draft`, slug único
- Útil para crear variaciones sin empezar de cero

**Archivos a modificar:**
- `frontend/src/pages/CMS.tsx` — botón + handler que llama a POST /cms/pages
- No requiere cambios de backend (reusa createContentPage)

---

### 7. ✏️ Edición manual de slug

**Utilidad: Media · Esfuerzo: Bajo**

- Slug se auto-genera del título pero no hay campo para sobrescribirlo
- Añadir campo editable en formulario (con validación de unicidad en backend)
- Ya existe `GET /cms/pages/slug/:slug` para verificar disponibilidad

**Archivos a modificar:**
- `frontend/src/pages/CMS.tsx` — campo slug en formData
- `src/services/cms/cms.ts` — permitir slug explícito en create/update

---

### 8. 👤 Visualización de autor

**Utilidad: Baja · Esfuerzo: Muy bajo**

- `authorId` se almacena pero nunca se muestra
- Añadir columna "Author" en lista + "Created by" / "Last updated by" en vista
- Opcional: enriquecer con `populate` para mostrar nombre real

**Archivos a modificar:**
- `frontend/src/pages/CMS.tsx` — columna en tabla + metadatos en vista
- Opcional: `src/services/cms/cms.ts` — populate authorId con User

---

### 9. ✅ Operaciones bulk (publicar/archivar/eliminar)

**Utilidad: Media · Esfuerzo: Medio**

- Checkboxes en lista de páginas + barra de acciones
- Endpoints batch: `POST /cms/pages/batch/publish`, `POST /cms/pages/batch/delete`
- Frontend: confirmación, notificación de resultado

**Archivos a modificar:**
- `src/routes/index.ts` — nuevos endpoints batch
- `src/services/cms/cms.ts` — funciones batch
- `frontend/src/pages/CMS.tsx` — checkboxes + barra + confirmación

---

### 10. 📅 Programación de publicación

**Utilidad: Media · Esfuerzo: Medio-Alto**

- Añadir campos `publishAt` / `unpublishAt` al schema
- Cron job o setInterval que verifica cada 5 min y cambia status
- UI: datepicker en formulario + indicador "Scheduled" en lista
- Menor prioridad porque el flujo manual draft→published ya funciona

**Archivos a modificar:**
- `src/db/mongo/models.ts` — añadir publishAt, unpublishAt a ContentPageSchema
- `src/services/cms/cms.ts` — scheduler + validación en create/update
- `src/index.ts` — iniciar scheduler al startup
- `frontend/src/pages/CMS.tsx` — datepicker + indicador
