/**
 * @file ws/index.ts
 * @description Barrel file — re-exports all WebSocket contract types.
 *
 * Import from this barrel in Angular services:
 * @example
 * import type { WsMessage, ChatMessagePayload } from '@cortex-id/shared-types';
 * import { WS_EVENTS, WsMessageType } from '@cortex-id/shared-types';
 */

export * from './messages.types';
export * from './events';
