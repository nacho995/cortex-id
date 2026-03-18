# Cortex-ID — Claude Code Context

## Qué es este proyecto
IDE de escritorio open source que compite con Cursor.
Stack: Angular 17+ (frontend) + Java 21 Spring Boot (backend) + Electron (desktop).

## Stack técnico
- **Frontend**: Angular 17+ standalone, TypeScript strict, Signals, OnPush, Monaco Editor, xterm.js
- **Backend**: Java 21, Spring Boot 3.3+, Spring WebSocket, SQLite, Maven
- **Desktop**: Electron 28+, node-pty, contextBridge (nunca nodeIntegration)
- **Comunicación**: IPC contextBridge (Electron↔Angular) + WebSocket puerto 7432 (Angular↔Java)

## Subagentes disponibles
- `orchestrator` — planifica y delega tareas complejas
- `electron-specialist` — IPC, node-pty, keychain, BrowserWindow
- `angular-specialist` — componentes, Monaco, xterm.js, signals
- `java-specialist` — Spring Boot, WebSocket, SQLite, AI clients
- `ipc-debugger` — diagnostica comunicación entre capas
- `ui-fixer` — CSS, layout, temas, botones invisibles
- `debugger` — traza flujos end-to-end para encontrar bugs
- `tester` — tests unitarios e integración
- `security-auditor` — vulnerabilidades y seguridad (solo lectura)

## Convenciones Angular
- Standalone components siempre, sin NgModules
- OnPush ChangeDetection en todos los componentes
- Signals para estado local
- NUNCA colores hardcodeados — usar variables CSS del tema
- NUNCA innerHTML con datos del usuario sin DomSanitizer

## Convenciones Java
- Arquitectura hexagonal: domain → application → infrastructure
- Records para DTOs, constructor injection siempre
- Virtual threads habilitados
- Logs con SLF4J, nunca loguear API keys completas

## Convenciones Electron
- nodeIntegration: false, contextIsolation: true, sandbox: true SIEMPRE
- API keys SOLO en keychain via keytar, nunca en localStorage
- Validar TODAS las rutas de archivo (prevenir path traversal)

## Comandos de desarrollo
```bash
cd ~/projects/cortex-id && pnpm dev          # arranca todo
cd frontend && ng build                       # build frontend
cd backend && mvn compile                     # compila backend
cd backend && mvn spring-boot:run            # arranca backend solo
```

## Flujos críticos
1. **Chat AI**: Angular → WebSocket → Java → Anthropic/OpenAI/Google API → stream de vuelta
2. **Abrir archivo**: FileExplorer click → IPC → Electron → fs.readFile → Monaco
3. **Terminal**: xterm.js → IPC → node-pty → shell real
4. **API Key**: Settings.saveKey() → localStorage + keychain → WebSocket → Java.setApiKey()
5. **Speech**: VoiceService.startListening() → SpeechRecognition API → callback → sendMessage()
