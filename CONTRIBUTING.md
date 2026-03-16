# Contributing to Cortex-ID

Thank you for your interest in contributing to Cortex-ID! This guide will help you get started.

## Architecture Overview

Cortex-ID is a 3-layer desktop application:

| Layer | Technology | Directory |
|-------|-----------|-----------|
| Desktop | Electron 28+ | `electron/` |
| Frontend | Angular 17+ | `frontend/` |
| Backend | Java 21 Spring Boot | `backend/` |
| Contracts | TypeScript | `shared-types/` |

Communication flows: Angular <-> IPC <-> Electron <-> WebSocket <-> Java

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Java 21 (JDK)
- Maven >= 3.9

### Setup
```bash
git clone https://github.com/cortex-id/cortex-id.git
cd cortex-id
pnpm run setup
pnpm run dev
```

## Development Workflow

### Branch Naming
- `feat/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code refactoring
- `docs/description` — Documentation
- `test/description` — Tests

### Commit Messages
We use [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(frontend): add file search dialog
fix(backend): handle null API key gracefully
refactor(electron): extract IPC handler registration
docs: update architecture diagram
test(backend): add OrchestrationService tests
```

### Pull Request Process
1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run tests: `pnpm run test`
5. Submit a PR with a clear description

## Running Tests

```bash
# All tests
pnpm run test

# Frontend only (Angular)
pnpm run test:frontend

# Backend only (Java)
pnpm run test:backend

# Electron only
pnpm run test:electron
```

## Code Conventions

### Angular (Frontend)
- **Standalone components only** — no NgModules
- **OnPush change detection** on all components
- **Signals** for local state
- **Barrel files** (index.ts) in each feature folder
- **SCSS** for styles with CSS variables

### Java (Backend)
- **Hexagonal architecture**: domain -> application -> infrastructure
- **Records** for DTOs and Value Objects
- **Constructor injection** always (never @Autowired on fields)
- **SLF4J** for structured logging
- **CompletableFuture** for async operations

### Electron
- **contextBridge** for all renderer<->main communication
- **Never expose Node.js APIs** directly to renderer
- **Typed IPC** with shared-types contracts

### TypeScript (Shared)
- **Strict mode** enabled
- **JSDoc comments** on all public interfaces
- **Const objects** for channel/event names

## Security Guidelines

- **Never** store API keys in plain text on disk
- **Always** use keytar for credential storage
- **Never** expose ipcRenderer directly in preload
- **Always** validate inputs in IPC handlers
- User code **never** leaves the machine

## Adding a New Feature

1. **Define contracts** in `shared-types/` first
2. **Implement backend** service in `backend/`
3. **Add IPC handler** in `electron/` if needed
4. **Build UI** in `frontend/`
5. **Write tests** for all layers
6. **Update docs** if architecture changes

## Reporting Issues

Use GitHub Issues with these labels:
- `bug` — Something isn't working
- `feature` — New feature request
- `docs` — Documentation improvement
- `good-first-issue` — Good for newcomers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
