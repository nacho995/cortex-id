# Cortex-ID Architecture

## Overview

Cortex-ID is a privacy-first, AI-powered IDE built as a 3-layer desktop application.

```
+-------------------------------------------------------------+
|                    Electron Shell                            |
|  +--------------+  +--------------+  +--------------+       |
|  |   Window     |  |   IPC        |  |   Native     |       |
|  |   Manager    |  |   Handlers   |  |   APIs       |       |
|  +--------------+  +------+-------+  +--------------+       |
|                           | contextBridge                    |
|  +------------------------+-----------------------------+   |
|  |              Angular Frontend                         |   |
|  |  +----------+ +----------+ +----------+              |   |
|  |  | Monaco   | | xterm.js | | AI Chat  |              |   |
|  |  | Editor   | | Terminal | | Panel    |              |   |
|  |  +----------+ +----------+ +----+-----+              |   |
|  |                                  | WebSocket          |   |
|  +----------------------------------+-------------------+   |
|                                     |                        |
+-------------------------------------+------------------------+
                                      |
+-------------------------------------+------------------------+
|              Java Spring Boot Backend (port 7432)            |
|  +--------------+  +--------------+  +--------------+       |
|  | Orchestrator |  | File Indexer |  | Git Service  |       |
|  | (AI Router)  |  |              |  | (JGit)       |       |
|  +------+-------+  +--------------+  +--------------+       |
|         |                                                    |
|  +------+-------+  +--------------+  +--------------+       |
|  | AI Clients   |  | Project      |  | SQLite DB    |       |
|  | Claude/Ollama|  | Memory       |  | ~/.cortex-id |       |
|  +--------------+  +--------------+  +--------------+       |
+--------------------------------------------------------------+
```

## Communication Layers

### 1. Angular <-> Electron (IPC)
- **Protocol**: Electron IPC via contextBridge
- **Security**: No Node.js APIs exposed to renderer
- **Typing**: Shared TypeScript contracts in `shared-types/ipc/`
- **Pattern**: Request/Response via `ipcRenderer.invoke()`, Events via `ipcRenderer.on()`

### 2. Angular <-> Java (WebSocket)
- **Protocol**: WebSocket at `ws://localhost:7432/ws`
- **Format**: JSON messages with type discriminator
- **Typing**: Shared contracts in `shared-types/ws/`
- **Features**: Streaming responses, auto-reconnect, heartbeat

### 3. Java <-> External APIs (HTTP)
- **Anthropic**: SSE streaming for Claude API
- **Ollama**: HTTP streaming for local models
- **Pattern**: BYOK (Bring Your Own Key)

## Detailed Module Structure

### Electron (`electron/`)

| Path | Responsibility |
|------|---------------|
| `src/main.ts` | App entry point, creates BrowserWindow, registers IPC handlers |
| `src/ipc/file-system.handler.ts` | File read/write/list operations |
| `src/ipc/terminal.handler.ts` | Terminal process (node-pty) management |
| `src/ipc/app.handler.ts` | App-level operations (open folder, settings) |
| `src/window/window-manager.ts` | BrowserWindow lifecycle and configuration |
| `src/native/backend-launcher.ts` | Spawns and manages the Java backend process |
| `src/native/platform.ts` | OS-specific utilities (paths, keychain) |
| `preload/index.ts` | contextBridge API definition |

### Frontend (`frontend/`)

| Path | Responsibility |
|------|---------------|
| `src/app/workbench/` | Main IDE layout (editor, terminal, sidebar, panels) |
| `src/app/workbench/editor/` | Monaco Editor integration with tab management |
| `src/app/workbench/terminal/` | xterm.js terminal component |
| `src/app/workbench/sidebar/` | File explorer with icon pipe |
| `src/app/workbench/panels/` | Output, problems, and debug panels |
| `src/app/workbench/settings/` | Settings panel for API keys and preferences |
| `src/app/ai/chat/` | AI chat panel and message rendering |
| `src/app/core/` | Singleton services (IPC, WebSocket, Config) |
| `src/app/shared/ui/` | Reusable UI components (button, icon, loading, tooltip) |

### Backend (`backend/`)

| Path | Responsibility |
|------|---------------|
| `ai/orchestrator/` | Routes messages to correct AI provider, manages context |
| `ai/AnthropicClient.java` | Claude API client with SSE streaming |
| `ai/OllamaClient.java` | Ollama local model client |
| `ai/AiModelConfig.java` | Model configuration and provider selection |
| `websocket/` | WebSocket handler, session registry, message types |
| `indexer/` | File indexing, language detection |
| `memory/` | Project memory and conversation persistence (SQLite) |
| `git/` | JGit integration (status, commits, diffs) |
| `config/` | CORS, security, data source configuration |
| `api/` | REST controllers (health check, config) |

### Shared Types (`shared-types/`)

| Path | Responsibility |
|------|---------------|
| `src/ipc/channels.ts` | IPC channel name constants |
| `src/ipc/file-system.types.ts` | File operation request/response types |
| `src/ipc/terminal.types.ts` | Terminal IPC message types |
| `src/ipc/app.types.ts` | App-level IPC types |
| `src/ipc/preload-api.types.ts` | contextBridge API surface type |
| `src/ws/events.ts` | WebSocket event name constants |
| `src/ws/messages.types.ts` | WebSocket message payload types |

## Key Design Decisions

### ADR-001: Privacy First Architecture
**Decision**: All code processing happens locally. User code never leaves the machine.
**Rationale**: Competing with Cursor requires a strong privacy story. Enterprise users need guarantees.
**Consequences**: No cloud backend, no telemetry, BYOK model.

### ADR-002: Electron + Angular + Java Stack
**Decision**: Three separate technology layers instead of a monolithic Electron app.
**Rationale**: 
- Angular provides a mature UI framework with strong typing
- Java provides robust backend capabilities (JGit, file indexing, AI orchestration)
- Electron provides desktop integration (file system, terminal, keychain)

**Consequences**: More complex build/deploy, but better separation of concerns.

### ADR-003: WebSocket for AI Communication
**Decision**: Use WebSocket instead of REST for AI chat communication.
**Rationale**: Streaming responses require bidirectional communication. WebSocket provides lower latency than SSE for bidirectional flows.
**Consequences**: More complex connection management, but better UX for streaming.

### ADR-004: SQLite for Local Storage
**Decision**: Use SQLite for project memory and conversation history.
**Rationale**: No external database dependency, works offline, fast for local operations.
**Consequences**: Limited concurrent write performance (acceptable for single-user desktop app).

### ADR-005: Shared TypeScript Contracts
**Decision**: Define all IPC and WebSocket message types in a shared TypeScript package.
**Rationale**: Prevents drift between frontend and Electron. Java backend mirrors the same structure.
**Consequences**: Must keep Java DTOs in sync manually (no code generation in v0.1).

### ADR-006: contextBridge Security Model
**Decision**: All Electron IPC goes through contextBridge with typed wrapper functions.
**Rationale**: Prevents XSS attacks from accessing Node.js APIs. Industry best practice.
**Consequences**: More boilerplate, but significantly more secure.

## Data Flow: Chat Message

```
1. User types message in ChatPanelComponent
2. Angular sends WsMessage<ChatMessagePayload> via WebSocketService
3. Java CortexWebSocketHandler receives and routes to OrchestrationService
4. OrchestrationService determines AI provider (Anthropic/Ollama)
5. AnthropicClient sends HTTP request with SSE streaming
6. Each SSE chunk is wrapped in WsMessage<StreamChunkPayload>
7. Chunk sent back via WebSocket to Angular
8. ChatPanelComponent appends chunk to current message
9. Final chunk has done=true, streaming ends
```

## Data Flow: File Operations

```
1. User clicks file in FileExplorerComponent
2. Angular calls IpcService.readFile({ path })
3. IpcService calls window.cortex.readFile() (contextBridge)
4. Electron preload invokes ipcRenderer.invoke('fs:read')
5. FileSystemHandler reads file with fs.promises.readFile()
6. Response flows back: Electron -> preload -> Angular
7. EditorComponent creates Monaco model with content
```

## Data Flow: Terminal

```
1. User opens terminal via TerminalComponent
2. Angular sends IPC request to create a PTY session
3. Electron TerminalHandler spawns node-pty process
4. Keystrokes flow: xterm.js -> IPC -> node-pty
5. Output flows: node-pty -> IPC -> xterm.js
6. Terminal resize events propagated via IPC
```

## Module Boundaries

| Module | Responsibility | Dependencies |
|--------|---------------|--------------|
| `shared-types` | Type contracts | None |
| `electron` | Desktop shell, IPC, native APIs | shared-types |
| `frontend` | UI, user interaction | shared-types |
| `backend` | AI, indexing, memory, git | None (mirrors shared-types) |

## Security Model

1. **Process Isolation**: Renderer process has no Node.js access
2. **contextBridge**: Only typed functions exposed to renderer
3. **API Key Storage**: keytar (OS keychain), never on disk
4. **No Telemetry**: Zero data collection
5. **Local Only**: Backend runs on localhost:7432, not exposed to network
6. **Input Validation**: All IPC handlers validate inputs before processing
7. **CORS Locked Down**: Backend only accepts requests from localhost origins

## Port Assignments

| Service | Port | Purpose |
|---------|------|---------|
| Java Backend | 7432 | REST API + WebSocket |
| Angular Dev Server | 4200 | Frontend dev server (dev only) |
| Electron | N/A | Main process, no port |
