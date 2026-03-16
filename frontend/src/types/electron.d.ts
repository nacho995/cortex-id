/**
 * Global Window augmentation for the Electron contextBridge API.
 * This file makes `window.cortex` available with full type safety
 * throughout the Angular application.
 */

import type { CortexBridgeAPI } from '@cortex-id/shared-types/ipc/preload-api.types';

declare global {
  interface Window {
    /** The Cortex-ID bridge API injected by the Electron preload script. */
    cortex?: CortexBridgeAPI;
  }
}

export {};
