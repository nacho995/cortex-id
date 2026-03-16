/**
 * @file ipc/index.ts
 * @description Barrel file — re-exports all IPC contract types.
 *
 * Import from this barrel in both Electron and Angular:
 * @example
 * import type { ReadFileRequest, CortexBridgeAPI } from '@cortex-id/shared-types';
 */

export * from './file-system.types';
export * from './terminal.types';
export * from './app.types';
export * from './channels';
export * from './preload-api.types';
