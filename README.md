# Cortex-ID

> Open source AI-powered IDE — Privacy-first, transparent AI agents

Cortex-ID is a desktop IDE built with **Angular + Java Spring Boot + Electron** that competes with Cursor but with key advantages:

- **Privacy first**: Your code never leaves your machine
- **Bring Your Own Key**: Use your own API keys for AI providers
- **Offline capable**: Works with local models via Ollama
- **Transparent AI**: See what each AI agent does in real-time
- **Open source**: Core is MIT licensed

## Features (v0.1 MVP)

- **Monaco Editor** — Full-featured code editor with syntax highlighting, multi-tab support, and IntelliSense
- **File Explorer** — Browse and open project files from the sidebar with language-aware icons
- **Integrated Terminal** — xterm.js + node-pty terminal embedded in the workbench
- **AI Chat Panel** — Chat with Claude or local models (Ollama) via streaming WebSocket
- **Settings Panel** — Configure API keys and editor preferences
- **Git Integration** — View status, commits, and diffs via JGit
- **File Indexing** — Automatic language detection and file indexing for project context
- **Project Memory** — Persistent conversation history and project context in SQLite
- **Java Backend** — Automatically launched and managed by Electron in the background

## Screenshots

> Screenshots will be added after the v0.1 UI is finalized.

## Architecture

```
Angular (renderer) <-> IPC <-> Electron (main) <-> WebSocket <-> Java Spring Boot (backend)
                                                                    |
                                                          AI APIs (Claude, OpenAI, Ollama)
```

For detailed architecture documentation, see [docs/architecture.md](docs/architecture.md).

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Java** 21 (JDK)
- **Maven** >= 3.9

## Quick Start

```bash
# Clone the repository
git clone https://github.com/cortex-id/cortex-id.git
cd cortex-id

# Install all dependencies
pnpm run setup

# Start development (all 3 layers)
pnpm run dev
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm run setup` | Install all dependencies |
| `pnpm run dev` | Start all layers (Electron + Angular + Java) |
| `pnpm run dev:frontend` | Start Angular dev server only |
| `pnpm run dev:electron` | Start Electron only |
| `pnpm run dev:backend` | Start Java backend only |
| `pnpm run build` | Build all layers for production |
| `pnpm run test` | Run all tests |
| `pnpm run test:frontend` | Run Angular tests |
| `pnpm run test:backend` | Run Java tests |
| `pnpm run package` | Package for distribution |
| `pnpm run clean` | Clean all build artifacts |

## Project Structure

```
cortex-id/
├── electron/              # Electron main process (TypeScript)
│   ├── src/
│   │   ├── main.ts        # Entry point
│   │   ├── ipc/           # IPC handlers (file system, terminal, app)
│   │   ├── window/        # BrowserWindow management
│   │   └── native/        # Backend launcher, platform utilities
│   └── preload/
│       └── index.ts       # contextBridge API
├── frontend/              # Angular 17+ app (standalone components)
│   └── src/app/
│       ├── workbench/     # IDE layout (editor, terminal, sidebar, panels, settings)
│       ├── ai/            # AI features (chat panel, message rendering)
│       ├── core/          # Services (IPC, WebSocket, Config)
│       └── shared/        # Reusable UI components
├── backend/               # Java 21 Spring Boot
│   └── src/main/java/dev/cortexid/
│       ├── ai/            # AI orchestrator, Anthropic + Ollama clients
│       ├── websocket/     # WebSocket handler, session registry
│       ├── indexer/       # File indexing, language detection
│       ├── memory/        # Project memory, conversation persistence
│       ├── git/           # JGit integration
│       ├── config/        # CORS, security, data config
│       └── api/           # REST controllers (health, config)
├── shared-types/          # Shared TypeScript contracts
│   └── src/
│       ├── ipc/           # IPC channel names and message types
│       └── ws/            # WebSocket event names and message types
├── infrastructure/        # Docker, scripts, CI/CD
└── docs/                  # Architecture documentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 28+ |
| Frontend | Angular 17+, Monaco Editor, xterm.js |
| Backend | Java 21, Spring Boot 3.3+, WebSocket |
| Database | SQLite (local, embedded) |
| AI | Claude API, OpenAI, Ollama |
| Editor | Monaco Editor |
| Terminal | xterm.js + node-pty |
| Git | JGit |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` / `Cmd+P` | Quick file open |
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Command palette |
| `Ctrl+\`` | Toggle terminal |
| `Ctrl+B` / `Cmd+B` | Toggle sidebar |
| `Ctrl+S` / `Cmd+S` | Save file |
| `Ctrl+Shift+E` | Focus file explorer |
| `Ctrl+Shift+G` | Focus git panel |
| `Ctrl+L` | Open AI chat |
| `Ctrl+W` / `Cmd+W` | Close current tab |
| `Ctrl+Tab` | Next editor tab |
| `Ctrl+Shift+Tab` | Previous editor tab |

## Roadmap

### v0.2 — Intelligence Layer
- Visible AI agents with work timeline
- Local project memory (SQLite)
- Bring Your Own API Key settings panel
- Speech-to-code (basic)
- Inline suggestions (ghost text)
- LSP integration

### v0.3 — Context Engine
- RAG semantic search with embeddings (pgvector)
- Agent marketplace (community-built agents)
- Multi-file context for AI conversations
- Tree-sitter AST analysis

### v1.0 — Production Release
- Cortex Cloud (optional, opt-in sync)
- Multi-user collaboration
- Extension API
- Cross-platform builds (macOS, Linux, Windows)
- Auto-update mechanism

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup instructions
- Code conventions for Angular, Java, Electron, and TypeScript
- Branch naming and commit message guidelines
- Security guidelines
- How to add a new feature across all layers

## Documentation

- [Architecture Overview](docs/architecture.md) — System design, communication layers, ADRs, and data flows
- [Contributing Guide](CONTRIBUTING.md) — How to set up, develop, and submit changes

## License

MIT — see [LICENSE](LICENSE) for details.
