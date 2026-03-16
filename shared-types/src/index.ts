/**
 * @file src/index.ts
 * @description Root barrel file for @cortex-id/shared-types.
 *
 * Re-exports every IPC and WebSocket contract type so consumers can import
 * from a single entry point:
 *
 * @example
 * // Electron main process
 * import type { ReadFileRequest, IpcChannel } from '@cortex-id/shared-types';
 *
 * // Angular service
 * import type { CortexBridgeAPI, WsMessage, ChatMessagePayload } from '@cortex-id/shared-types';
 * import { IPC_CHANNELS, WS_EVENTS, WsMessageType } from '@cortex-id/shared-types';
 *
 * // Preload script
 * import type { ElectronWindow } from '@cortex-id/shared-types';
 */

// IPC contracts (Electron ↔ Angular via contextBridge)
export * from './ipc';

// WebSocket contracts (Angular ↔ Java Spring Boot)
export * from './ws';
