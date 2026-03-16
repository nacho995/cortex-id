/**
 * @file events.ts
 * @description Canonical WebSocket event name constants.
 *              These string values are the `type` field in every WsMessage envelope
 *              and must match the Java backend's WsMessageType enum exactly.
 *
 * IMPACT: Renaming or removing a constant breaks:
 *   - backend/src/main/java/dev/cortexid/websocket/WsMessageType.java
 *   - frontend/src/app/core/websocket.service.ts  (switch/case on message type)
 *   - frontend/src/app/ai/chat/                   (chat message handling)
 *   - frontend/src/app/ai/agents/                 (agent status handling)
 *   - frontend/src/app/ai/                        (model selector)
 *   - frontend/src/app/core/settings/             (provider config panel)
 *
 * Convention: '<domain>:<action>'
 *   - domain  = functional area (chat, agent, file, health, models, provider, config)
 *   - action  = verb or noun describing the event
 */

export const WS_EVENTS = {
  // ── Chat ───────────────────────────────────────────────────────────────────
  /** Angular → Java: User sends a chat message. Payload: ChatMessagePayload */
  CHAT_MESSAGE: 'chat:message',
  /** Java → Angular: Complete (non-streaming) AI response. Payload: ChatResponsePayload */
  CHAT_RESPONSE: 'chat:response',
  /** Java → Angular: Streaming response begins. Payload: { conversationId: string } */
  CHAT_STREAM_START: 'chat:stream-start',
  /** Java → Angular: Incremental streaming chunk. Payload: StreamChunkPayload */
  CHAT_STREAM_CHUNK: 'chat:stream-chunk',
  /** Java → Angular: Streaming response complete. Payload: { conversationId: string } */
  CHAT_STREAM_END: 'chat:stream-end',
  /** Java → Angular: Error during AI processing. Payload: ErrorPayload */
  CHAT_ERROR: 'chat:error',

  // ── Agents ─────────────────────────────────────────────────────────────────
  /** Java → Angular: Agent lifecycle state change. Payload: AgentStatusPayload */
  AGENT_STATUS: 'agent:status',
  /** Java → Angular: Agent task progress update. Payload: AgentStatusPayload */
  AGENT_PROGRESS: 'agent:progress',

  // ── File Indexer ───────────────────────────────────────────────────────────
  /** Java → Angular: Indexing progress update. Payload: FileIndexStatusPayload */
  FILE_INDEX_STATUS: 'file:index-status',
  /** Java → Angular: Indexing finished. Payload: FileIndexStatusPayload */
  FILE_INDEX_COMPLETE: 'file:index-complete',

  // ── Health ─────────────────────────────────────────────────────────────────
  /** Angular → Java: Heartbeat ping. Payload: {} */
  HEALTH_PING: 'health:ping',
  /** Java → Angular: Heartbeat pong. Payload: {} */
  HEALTH_PONG: 'health:pong',

  // ── Models ─────────────────────────────────────────────────────────────────
  /** Angular → Java: Request the full model catalogue. Payload: {} */
  MODELS_REQUEST: 'models:request',
  /** Java → Angular: Full model catalogue response. Payload: ModelsListPayload */
  MODELS_LIST: 'models:list',
  /** Java → Angular: Model availability changed (push). Payload: ModelsListPayload */
  MODELS_UPDATED: 'models:updated',

  // ── Provider config ────────────────────────────────────────────────────────
  /** Java → Angular: Provider health/availability update. Payload: ProviderStatusPayload */
  PROVIDER_STATUS: 'provider:status',
  /** Angular → Java: Store an API key for a provider. Payload: ApiKeySetPayload */
  API_KEY_SET: 'config:api-key-set',
  /** Angular → Java: Validate an API key without persisting it. Payload: ApiKeyTestPayload */
  API_KEY_TEST: 'config:api-key-test',
  /** Java → Angular: Result of API key validation. Payload: ApiKeyTestResultPayload */
  API_KEY_TEST_RESULT: 'config:api-key-test-result',
} as const;

/** Union type of all valid WebSocket event strings. */
export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
