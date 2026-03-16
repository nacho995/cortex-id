# Cortex-ID — AI-Powered IDE

## Qué es este proyecto
Cortex-ID es un IDE de escritorio open source construido con Angular + Java Spring Boot + Electron.
Compite directamente con Cursor pero con ventajas clave: privacidad total (el código nunca sale
de la máquina del usuario), agentes de IA visibles y auditables, y un marketplace de agentes
construido por la comunidad.

## Stack técnico
- **Frontend**: Angular 17+ standalone components, TypeScript strict, Signals, OnPush
- **Backend**: Java 21, Spring Boot 3.3+, Spring WebSocket, Maven
- **Desktop**: Electron 28+, node-pty, contextBridge API segura
- **Base de datos**: SQLite (local, embebida), pgvector para embeddings
- **IA**: Anthropic Claude API (principal), soporte para OpenAI y Ollama local
- **Editor**: Monaco Editor (mismo que VSCode)
- **Terminal**: xterm.js + node-pty
- **Voz**: Web Speech API + Whisper API

## Arquitectura de carpetas
```
cortex-id/
├── electron/                  # Main process Electron
│   ├── src/
│   │   ├── main.ts            # Entry point
│   │   ├── ipc/               # IPC handlers tipados
│   │   ├── window/            # BrowserWindow management
│   │   └── native/            # OS integrations (file system, pty)
│   └── preload/
│       └── index.ts           # contextBridge API segura
├── frontend/                  # Angular app
│   ├── src/
│   │   ├── app/
│   │   │   ├── workbench/     # Layout principal del IDE
│   │   │   │   ├── editor/    # Monaco Editor component
│   │   │   │   ├── terminal/  # xterm.js component
│   │   │   │   ├── sidebar/   # File explorer, search, git
│   │   │   │   └── panels/    # Output, problems, debug
│   │   │   ├── ai/
│   │   │   │   ├── chat/      # Panel de chat multiagente
│   │   │   │   ├── inline/    # Ghost text suggestions
│   │   │   │   ├── agents/    # Panel de agentes activos
│   │   │   │   └── voice/     # Speech-to-code
│   │   │   ├── core/          # Auth, config, IPC service
│   │   │   └── shared/        # UI components, pipes, directives
│   │   └── environments/
├── backend/                   # Java Spring Boot
│   ├── src/main/java/dev/cortexid/
│   │   ├── lsp/               # LSP proxy universal
│   │   ├── ai/
│   │   │   ├── orchestrator/  # Router de modelos e intención
│   │   │   ├── agents/        # Agentes especializados
│   │   │   └── rag/           # RAG con embeddings
│   │   ├── indexer/           # Tree-sitter + AST analysis
│   │   ├── memory/            # Memoria persistente por proyecto
│   │   ├── git/               # JGit integration
│   │   └── websocket/         # WebSocket handlers
│   └── pom.xml
├── shared-types/              # Contratos TypeScript compartidos
│   ├── ipc/                   # Tipos IPC Electron↔Angular
│   └── ws/                    # Tipos WebSocket Angular↔Java
└── infrastructure/
    ├── docker-compose.yml     # Dependencias locales
    └── scripts/               # Setup y build scripts
```

## Comunicación entre capas
```
Angular (renderer process)
    ↕ IPC via contextBridge (tipado, seguro)
Electron (main process)
    ↕ WebSocket (streaming, bidireccional)
Java Spring Boot (backend local en puerto 7432)
    ↕ HTTP/REST (operaciones síncronas)
APIs externas (Anthropic, OpenAI, Whisper)
```

## Principios de desarrollo
- **Privacy first**: el código del usuario nunca sale de su máquina
- **Bring Your Own Key**: el usuario usa su propia API key
- **Offline capable**: funciona con modelos locales (Ollama)
- **Transparent AI**: el usuario ve qué agente hace qué en tiempo real
- **Open source**: todo el core es MIT license

## Convenciones de código

### Angular
- Standalone components siempre, sin NgModules
- Signals para estado local, NgRx Signals Store para estado global
- OnPush change detection en todos los componentes
- Typed forms con NonNullableFormBuilder
- Barrel files (index.ts) en cada feature

### Java
- Arquitectura hexagonal: domain → application → infrastructure
- Records para DTOs y Value Objects
- Constructor injection siempre, nunca @Autowired en campo
- Async con CompletableFuture o WebFlux para streaming
- Logs estructurados con SLF4J

### Electron
- contextBridge para toda comunicación renderer↔main
- Nunca exponer APIs de Node directamente al renderer
- IPC tipado con tipos compartidos de shared-types/

## Features v0.1 (MVP — lo que construimos ahora)
1. Ventana principal del IDE con layout básico
2. Editor Monaco con syntax highlighting
3. Explorador de archivos en sidebar
4. Terminal integrada con xterm.js + node-pty
5. Panel de chat básico conectado a Claude API
6. Apertura y guardado de archivos via IPC
7. Backend Java arrancando en background desde Electron
8. WebSocket connection Angular↔Java

## Features v0.2 (siguiente iteración)
- Agentes visibles con timeline de trabajo
- Memoria local por proyecto (SQLite)
- Bring Your Own API Key (settings panel)
- Speech-to-code básico
- Inline suggestions (ghost text)

## Lo que NO construimos en v0.1
- RAG semántico (v0.3)
- LSP completo (v0.2)
- Agent marketplace (v0.3)
- Cortex Cloud (v1.0)
- Colaboración multi-usuario (v1.0)

## Comandos de desarrollo
```bash
# Instalar todo
npm run setup

# Desarrollo
npm run dev              # Arranca todo (Electron + Angular + Java)
npm run dev:frontend     # Solo Angular
npm run dev:electron     # Solo Electron
npm run dev:backend      # Solo Java

# Build
npm run build            # Build completo
npm run package          # Empaqueta para distribución

# Tests
npm run test             # Todos los tests
npm run test:frontend    # Angular tests
npm run test:backend     # Java tests
```

## Contexto importante para el agente
- El backend Java arranca en el puerto 7432 (evitar conflictos con otros servicios)
- Electron carga el frontend desde localhost:4200 en dev, desde dist/ en prod
- La API key de Anthropic se guarda en el keychain del sistema operativo, nunca en disco
- SQLite se guarda en el directorio de datos de la app (~/.cortex-id/)
- El proyecto usa pnpm como gestor de paquetes
