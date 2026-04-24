# InfoSec Agent 🤖

Asistente de IA para consultas de ciberseguridad con Knowledge Base integrado.

## 📋 Descripción

**InfoSec Agent** es una aplicación de chatbot especializada en ciberseguridad que permite:

- 💬 **Chat con múltiples agentes** especializados (InfoSec, Compliance, IT, Cloud, Legal, Dev, Gap Analysis, Standard)
- 📚 **Knowledge Base** - Gestión de documentos para enriquecer las respuestas
- 👥 **Gestión de clientes** - CRM integrado para seguimiento de casos
- 🔍 **Búsqueda semántica** en documentos mediante embeddings
- 💾 **Persistencia** de conversaciones en MongoDB

## 🛠️ Tecnologías

| Componente | Tecnología |
|------------|------------|
| **Backend** | Node.js + TypeScript + Fastify |
| **Base de datos** | MongoDB + Mongoose |
| **LLM** | Ollama (qwen2.5-coder:0.5b) |
| **Embeddings** | Ollama (mismo modelo) |
| **Knowledge Base** | ChromaDB (pendiente de configurar) |
| **Frontend** | React + Vite + TypeScript |

## 🚀 Instalación

### Entorno de prueba con Docker

Si no tienes `node`/`npm` instalados localmente, puedes levantar un entorno completo de prueba con Docker:

```bash
docker compose up -d --build
docker compose exec backend npm run seed:admin
```

Servicios:

- Frontend: `http://localhost:5174`
- Backend: `http://localhost:3001`
- MongoDB: `mongodb://localhost:27017/infosec`

Credenciales iniciales:

- Usuario: `admin`
- Password: `Admin123!@#`

Para detener el entorno:

```bash
docker compose down
```

### Prerrequisitos

- Node.js 18+
- MongoDB 4.4+
- Ollama (para el modelo LLM)

### Pasos de instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/oscarlgarcia/infosec.git
cd infosec
```

2. **Instalar dependencias del backend**
```bash
npm install
```

3. **Instalar dependencias del frontend**
```bash
cd frontend
npm install
```

4. **Configurar variables de entorno**

Copia el archivo `.env.example` a `.env` y configura:
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus valores:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/infosec
OPENAI_API_KEY=tu-api-key
OPENAI_MODEL=qwen2.5-coder:0.5b

# JWT Authentication (requerido)
JWT_SECRET=tu-super-secreto-jwt-key-de-al-menos-32-caracteres
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=tu-super-secreto-refresh-key-de-al-menos-32-caracteres
JWT_REFRESH_EXPIRES_IN=30d
```

> **Importante**: Genera secrets fuertes para JWT_SECRET y JWT_REFRESH_SECRET (mínimo 32 caracteres)

5. **Iniciar Ollama**

Asegúrate de tener Ollama corriendo con el modelo:
```bash
ollama serve
ollama pull qwen2.5-coder:0.5b
```

6. **Iniciar MongoDB**
```bash
mongod --dbpath /ruta/a/tu/data/mongodb
```

## ▶️ Ejecución

### Backend
```bash
# Con tsx (desarrollo)
npm run dev

# Compilado
npm run build
node dist/index.js
```

### Frontend
```bash
cd frontend
npm run dev
```

### Script de gestión de servidores
```bash
# Iniciar ambos servidores
./scripts/servers.sh start

# Detener ambos servidores
./scripts/servers.sh stop

# Reiniciar ambos servidores
./scripts/servers.sh restart

# Ver estado
./scripts/servers.sh status

# Gestionar solo backend
./scripts/servers.sh backend start|stop|restart

# Gestionar solo frontend
./scripts/servers.sh frontend start|stop|restart
```

## 🔐 Autenticación y Roles

### Sistema de Roles

La aplicación cuenta con un sistema de control de acceso basado en roles (RBAC):

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **admin** | Administrador | Acceso total a todas las funcionalidades |
| **manager** | Gerente | Gestión de clientes, conversaciones, documentos, Q&A, CMS |
| **sme** | Experto temático | Creación/edición de contenido (documents, Q&A, CMS) |
| **usuario** | Usuario básico | Solo chat y visualización de contenido público |

### Crear Administrador Inicial

Antes de usar la aplicación, necesitas crear un usuario administrador:

```bash
npm run seed:admin
```

Esto crea un usuario admin con las credenciales:
- **Username**: `admin`
- **Password**: `Admin123!@#`

### Iniciar Sesión

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!@#"}'
```

Respuesta exitosa:
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "65f...",
    "username": "admin",
    "email": "admin@infosec.local",
    "role": "admin"
  }
}
```

### Usar el Token

Incluye el token en las peticiones:

```bash
curl http://localhost:3000/clients \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

## 📱 Uso

### Acceder a la aplicación

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### Agentes Disponibles

| Agente | Descripción |
|--------|-------------|
| **Standard** | Respuesta directa del modelo sin búsquedas |
| **InfoSec** | Búsqueda en Q&A + KB + respuestas de ciberseguridad |
| **Compliance** | Consultas de cumplimiento normativo |
| **IT** | Consultas de infraestructura IT |
| **Cloud** | Consultas de servicios cloud |
| **Legal** | Consultas legales |
| **Dev** | Consultas de desarrollo |
| **Gap Analysis** | Análisis de brechas de seguridad |

### Flujo de trabajo

1. **Crear un cliente**: Click en "+ Cliente" para añadir un nuevo cliente
2. **Seleccionar cliente**: Elige el cliente del dropdown en el sidebar
3. **Nuevo chat**: Crea una nueva conversación
4. **Enviar mensaje**: Escribe tu pregunta y presiona Enter o click en buscar
5. **Cambiar agente**: Selecciona otro agente del dropdown para diferentes tipos de consultas

## 📂 Estructura del Proyecto

```
infosec/
├── src/                      # Código del backend
│   ├── config/              # Configuración
│   ├── db/                  # Conexiones a bases de datos
│   │   ├── mongo/          # MongoDB
│   │   └── vector/         # ChromaDB
│   ├── middleware/          # Middleware (auth, validation)
│   ├── routes/              # Endpoints de la API
│   ├── services/             # Lógica de negocio
│   │   ├── agent/          # Agentes de IA
│   │   ├── chat/           # Gestión de chats
│   │   ├── kb/             # Knowledge Base
│   │   └── llm/            # Integración con LLM
│   └── types/               # Tipos TypeScript
├── frontend/                # Código del frontend
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── contexts/       # Contextos (AuthContext)
│   │   ├── pages/          # Páginas (Login)
│   │   ├── i18n/           # Internacionalización
│   │   ├── styles/         # Estilos CSS
│   │   └── types/          # Tipos TypeScript
│   └── package.json
├── scripts/                 # Scripts (seed-admin.ts)
├── package.json             # Dependencias root
└── README.md
```
infosec/
├── src/                      # Código del backend
│   ├── config/              # Configuración
│   ├── db/                  # Conexiones a bases de datos
│   │   ├── mongo/          # MongoDB
│   │   └── vector/         # ChromaDB
│   ├── routes/              # Endpoints de la API
│   ├── services/             # Lógica de negocio
│   │   ├── agent/          # Agentes de IA
│   │   ├── chat/           # Gestión de chats
│   │   ├── kb/             # Knowledge Base
│   │   └── llm/            # Integración con LLM
│   └── types/               # Tipos TypeScript
├── frontend/                # Código del frontend
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── i18n/           # Internacionalización
│   │   ├── styles/         # Estilos CSS
│   │   └── types/          # Tipos TypeScript
│   └── package.json
├── scripts/                 # Scripts de gestión
├── package.json             # Dependencias root
└── README.md
```

## 🔌 API Endpoints

### Health
- `GET /health` - Estado del servidor (sin auth)

### Autenticación
- `POST /auth/login` - Iniciar sesión (sin auth)
- `POST /auth/refresh` - Renovar token (sin auth)
- `POST /auth/logout` - Cerrar sesión (requiere auth)
- `GET /auth/me` - Obtener usuario actual (requiere auth)

### Gestión de Usuarios (solo admin)
- `GET /users` - Listar usuarios
- `GET /users/:id` - Obtener usuario
- `POST /users` - Crear usuario
- `PUT /users/:id` - Actualizar usuario
- `DELETE /users/:id` - Eliminar usuario
- `PUT /users/:id/toggle-active` - Activar/desactivar usuario

### Clientes (admin, manager, sme)
- `POST /clients` - Crear cliente
- `GET /clients` - Listar clientes
- `GET /clients/:id` - Obtener cliente
- `PUT /clients/:id` - Actualizar cliente
- `DELETE /clients/:id` - Eliminar cliente

### Conversaciones
- `POST /conversations` - Crear conversación
- `GET /conversations/:id` - Obtener conversación
- `GET /conversations?clientId=xxx` - Listar conversaciones
- `POST /conversations/:id/chat` - Enviar mensaje
- `DELETE /conversations/:id` - Eliminar conversación

### Documentos
- `POST /documents` - Subir documento
- `GET /documents` - Listar documentos
- `DELETE /documents/:id` - Eliminar documento

### Knowledge Base
- `GET /kb/stats` - Estadísticas del KB
- `POST /kb/reindex` - Reindexar KB

### Búsqueda
- `GET /search?q=xxx&department=xxx` - Buscar en KB

### Q&A
- `POST /qa` - Crear entrada Q&A
- `GET /qa` - Listar entradas Q&A
- `DELETE /qa/:id` - Eliminar entrada Q&A

### RAG v1 (Core)
- `POST /chat/query` - Pipeline RAG con intent, retrieval, respuesta y trazabilidad
- `GET /responses/:id/trace` - Trazas completas de una respuesta (fuentes, flags, tokens, latencia)

### Ingestión v1
- `POST /ingestion/documents` - Ingestar documento con metadatos de gobierno
- `POST /ingestion/qa-file` - Cargar fichero de Q&A estructurada
- `POST /ingestion/rules` - Cargar reglas de estilo desde fichero

### Gobierno de conocimiento v1
- `GET /rules` - Listar reglas activas
- `POST /rules` - Crear regla
- `PUT /rules/:id` - Versionar/actualizar regla
- `DELETE /rules/:id` - Eliminar regla
- `GET /kb/candidates` - Listar candidatos KB
- `POST /kb/candidates/:id/approve` - Aprobar candidato y crear respuesta canónica
- `POST /kb/candidates/:id/reject` - Rechazar candidato

### Answer Builder v1
- `POST /answer-builder/jobs` - Crear job batch de cuestionarios
- `GET /answer-builder/jobs/:id` - Consultar estado/resultados de job

### Analytics v1
- `GET /analytics/overview` - Uso operativo (consultas, usuarios, latencia, tokens, coste)
- `GET /analytics/coverage-gaps` - Cobertura por dominio y backlog de gaps
- `GET /analytics/quality` - Calidad de respuesta (citations, fallback, confidence, contradicciones)

## 🔧 Configuración de Servicios Externos

### MongoDB
Puerto por defecto: `27017`

### Ollama
- URL: `http://localhost:11434` (o `http://llm-ollama:11434` en Docker)
- Modelo: `qwen2.5-coder:0.5b`

### ChromaDB (pendiente)
- URL: `http://localhost:8000`

## 📝 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 👤 Autor

Oscar Garcia - [@oscarlgarcia](https://github.com/oscarlgarcia)

---

¿Encontraste un bug? ¿Tienes sugerencias? Abre un issue en: https://github.com/oscarlgarcia/infosec/issues
