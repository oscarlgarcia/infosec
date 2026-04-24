# PLAN - InfoSec Agent App

## Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Fastify |
| LLM | OpenAI (GPT-4o + 4o-mini) |
| Base de datos | MongoDB + Mongoose |
| Knowledge Base | ChromaDB (embeddings) |
| Frontend | React + Vite ✅ Implementado |

---

## Diseño Pantalla Principal

### Elementos UI
- **Header**: Logo, dropdown clientes, dropdown agentes
- **Sidebar**: Panel lateral con clientes/workspaces (acordeón)
- **Chat Area**: Cajón de interacción en parte inferior
- **Botón Buscar**: Junto al input de texto
- **Dropdown Agentes**: Compliance, IT, Cloud, Legal, Dev, InfoSec (default), Gap Analysis

### Paleta de Colores (Board/SBC)
| Color | HEX |
|-------|-----|
| SBC Blue | #004680 |
| Navy | #002D61 |
| Gold | #CFB991 |
| Bright Blue | #0076D5 |

---

## Funcionalidades

### 1. Agente InfoSec (Core)
- **Lógica de respuesta** (system prompt del usuario):
  1. Normalizar pregunta
  2. Buscar en Q&A (similitud ≥97% → literal, 85-96% → tabla, <85% → tradicional)
  3. Búsqueda tradicional en Knowledge
  4. Formato bilingüe (ES/EN)
  5. Asignar roles: Cloud, IT, Development, Compliance, Legal
  6. DOC_GAP_REPORT si falta info

### 2. Gestión de Documentos KB
- Upload: PDF, TXT, Word, Excel, HTML
- Embeddings automáticos con OpenAI
- Metadatos: departamento
- Q&A como colección MongoDB

### 3. Chat
- Historial persistente en MongoDB
- Contexto por cliente
- Memoria entre conversaciones

### 4. Búsquedas
- Por Chatbot
- Por API
- Directamente en KB (semántica)

### 5. Admin Dashboard (pendiente)
- Estadísticas, documentos, KPI, SLA
- Más detalles por definir

### 6. Integraciones (pendiente)
- MCP servers, webhooks, Azure, GitHub
- Más detalles por definir

---

## Estructura del Proyecto
```
infosec-app/
├── src/
│   ├── config/
│   │   └── index.ts
│   ├── db/
│   │   ├── mongo/
│   │   │   ├── connection.ts
│   │   │   └── models.ts
│   │   └── vector/
│   │       └── chroma.ts
│   ├── services/
│   │   ├── llm/
│   │   │   └── openai.ts
│   │   ├── kb/
│   │   │   └── knowledge.ts
│   │   ├── agent/
│   │   │   └── infosec-agent.ts
│   │   └── chat/
│   │       └── chat.ts
│   ├── routes/
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── frontend/
│   └── (pendiente)
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

---

## Pendiente del Usuario
- System prompt completo (ya proporcionado)
- Detalles integraciones
- Profundizar dashboard admin
- Más requisitos adicionales

---

## API Endpoints

### Health
- `GET /health` - Estado del servidor

### Conversaciones
- `POST /conversations` - Crear conversación
- `GET /conversations/:id` - Obtener conversación
- `GET /conversations?clientId=xxx` - Listar conversaciones de cliente
- `POST /conversations/:id/chat` - Enviar mensaje
- `DELETE /conversations/:id` - Eliminar conversación

### Documentos
- `POST /documents` - Subir documento
- `GET /documents` - Listar documentos
- `DELETE /documents/:id` - Eliminar documento

### Búsqueda
- `GET /search?q=xxx&department=xxx&limit=5` - Buscar en KB

### Q&A
- `POST /qa` - Crear entrada Q&A
- `GET /qa` - Listar entradas Q&A
- `DELETE /qa/:id` - Eliminar entrada Q&A

---

## TODO - Pendientes

### Crear Agentes
- [ ] InfoSec (default)
- [ ] Compliance
- [ ] IT
- [ ] Cloud
- [ ] Legal
- [ ] Dev
- [ ] Gap Analysis

### Workspace/Chats
- [ ] Crear nuevo chat dentro del workspace
- [ ] Eliminar workspace completo
- [ ] Renombrar workspace
- [ ] Renombrar chat
- [ ] Exportar chat
- [ ] Eliminar chat

### Otros
- [ ] Soporte multiusuario (dejar para más adelante)
- [ ] Dashboard Admin
- [ ] Integraciones (MCP, webhooks, Azure, GitHub)
