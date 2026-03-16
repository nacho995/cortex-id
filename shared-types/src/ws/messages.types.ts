/**
 * @file messages.types.ts
 * @description WebSocket contract types for bidirectional communication between
 *              Angular (frontend) and Java Spring Boot (backend on port 7432).
 *
 * IMPACT: Changes here affect:
 *   - backend/src/main/java/dev/cortexid/websocket/  (Java DTOs must stay in sync)
 *   - frontend/src/app/core/websocket.service.ts      (must update message handling)
 *   - frontend/src/app/ai/chat/                       (must update chat component)
 *   - frontend/src/app/ai/agents/                     (must update agent panel)
 *   - frontend/src/app/ai/                            (must update model selector)
 *   - frontend/src/app/core/settings/                 (must update provider config UI)
 *
 * All messages follow the envelope pattern:
 *   { type, id, timestamp, payload }
 */

// ---------------------------------------------------------------------------
// Message type discriminator
// ---------------------------------------------------------------------------

/**
 * Discriminator values for all WebSocket message types.
 * Must stay in sync with WS_EVENTS constants and Java's WsMessageType enum.
 */
export enum WsMessageType {
  // Chat
  CHAT_MESSAGE      = 'chat:message',
  CHAT_RESPONSE     = 'chat:response',
  CHAT_STREAM_START = 'chat:stream-start',
  CHAT_STREAM_CHUNK = 'chat:stream-chunk',
  CHAT_STREAM_END   = 'chat:stream-end',
  CHAT_ERROR        = 'chat:error',

  // Agents
  AGENT_STATUS   = 'agent:status',
  AGENT_PROGRESS = 'agent:progress',

  // Indexer
  FILE_INDEX_STATUS   = 'file:index-status',
  FILE_INDEX_COMPLETE = 'file:index-complete',

  // Health
  HEALTH_PING = 'health:ping',
  HEALTH_PONG = 'health:pong',

  // Models
  MODELS_REQUEST  = 'models:request',
  MODELS_LIST     = 'models:list',
  MODELS_UPDATED  = 'models:updated',

  // Provider config
  PROVIDER_STATUS      = 'provider:status',
  API_KEY_SET          = 'config:api-key-set',
  API_KEY_TEST         = 'config:api-key-test',
  API_KEY_TEST_RESULT  = 'config:api-key-test-result',
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * Generic WebSocket message envelope.
 * Every message sent over the WebSocket connection uses this shape.
 *
 * @template T - The payload type specific to the message type.
 *
 * @example
 * const msg: WsMessage<ChatMessagePayload> = {
 *   type: WsMessageType.CHAT_MESSAGE,
 *   id: crypto.randomUUID(),
 *   timestamp: Date.now(),
 *   payload: { content: 'Hello!' },
 * };
 */
export interface WsMessage<T> {
  /** Discriminator — identifies the payload shape. */
  type: WsMessageType;
  /**
   * Unique message identifier (UUID v4).
   * Used to correlate requests with responses / stream chunks.
   */
  id: string;
  /** Unix timestamp in milliseconds when the message was created. */
  timestamp: number;
  /** Message-specific payload. */
  payload: T;
}

// ---------------------------------------------------------------------------
// Chat payloads
// ---------------------------------------------------------------------------

/**
 * Context attached to a chat message to give the AI model awareness of the
 * currently open file or selected code.
 */
export interface ChatContext {
  /** Absolute path of the file currently open in the editor. */
  filePath?: string;
  /** Code snippet selected by the user in the editor. */
  selectedCode?: string;
  /** Language identifier of the open file (e.g. 'typescript', 'java'). */
  language?: string;
}

/**
 * Payload for CHAT_MESSAGE — sent from Angular to Java.
 * Triggers the AI orchestrator to route the request to the appropriate agent.
 */
export interface ChatMessagePayload {
  /** User's message text. */
  content: string;
  /** Optional editor context to include in the AI prompt. */
  context?: ChatContext;
  /**
   * Model override (e.g. 'claude-sonnet-4-6').
   * When absent, the backend uses the model from AppSettings.
   */
  model?: string;
  /**
   * Conversation thread identifier.
   * Omit to start a new conversation; include to continue an existing one.
   */
  conversationId?: string;
  /** Agent interaction mode. Controls how the AI processes the request. */
  mode?: AgentMode;
  /**
   * API key for the selected provider.
   * Sent from the frontend when available (browser localStorage or Electron keychain via IPC).
   * The backend can also use its in-memory provider config when this field is absent.
   * Never logged or persisted to disk by the backend.
   */
  apiKey?: string;
}

/**
 * Payload for CHAT_RESPONSE — sent from Java to Angular (non-streaming).
 * Used when the full response is available at once.
 */
export interface ChatResponsePayload {
  /** Complete AI response text. */
  content: string;
  /** Model that generated the response. */
  model: string;
  /** Conversation thread identifier (created by the backend if new). */
  conversationId: string;
  /** ID of the agent that handled the request (if applicable). */
  agentId?: string;
  /** Token usage statistics for cost tracking. */
  tokensUsed?: {
    /** Number of input tokens consumed. */
    input: number;
    /** Number of output tokens generated. */
    output: number;
  };
}

/**
 * Payload for CHAT_STREAM_CHUNK — sent from Java to Angular during streaming.
 * Multiple chunks are sent sequentially; the last chunk has `done: true`.
 */
export interface StreamChunkPayload {
  /** Incremental text fragment from the AI model. */
  content: string;
  /** Conversation thread identifier. */
  conversationId: string;
  /** ID of the agent that is generating the response (if applicable). */
  agentId?: string;
  /** True on the final chunk — signals that the stream is complete. */
  done: boolean;
}

// ---------------------------------------------------------------------------
// Agent payloads
// ---------------------------------------------------------------------------

/**
 * Payload for AGENT_STATUS — pushed from Java to Angular.
 * Drives the "active agents" panel in the UI.
 */
export interface AgentStatusPayload {
  /** Unique identifier for the agent instance. */
  agentId: string;
  /** Human-readable agent name (e.g. "Code Reviewer", "Refactor Agent"). */
  name: string;
  /** Current lifecycle state of the agent. */
  status: 'idle' | 'thinking' | 'working' | 'done' | 'error';
  /** Short description of what the agent is currently doing. */
  task?: string;
  /** Completion percentage (0–100) for long-running tasks. */
  progress?: number;
}

// ---------------------------------------------------------------------------
// Indexer payloads
// ---------------------------------------------------------------------------

/**
 * Payload for FILE_INDEX_STATUS — pushed from Java to Angular during indexing.
 * Drives the indexing progress indicator in the status bar.
 */
export interface FileIndexStatusPayload {
  /** Total number of files to index. */
  totalFiles: number;
  /** Number of files processed so far. */
  processedFiles: number;
  /** Absolute path of the file currently being indexed. */
  currentFile?: string;
  /** Current indexing phase. */
  status: 'indexing' | 'complete' | 'error';
}

// ---------------------------------------------------------------------------
// AI Provider types
// ---------------------------------------------------------------------------

/** Supported AI provider identifiers. */
export type AiProvider = 'anthropic' | 'openai' | 'google' | 'ollama';

/** Agent interaction mode. Controls how the AI processes the request. */
export type AgentMode = 'ask' | 'agent' | 'edit';

/**
 * Model information for the model selector.
 * Sent from Java to Angular as part of ModelsListPayload.
 */
export interface ModelInfo {
  /** Unique model identifier (e.g. 'claude-sonnet-4-6'). */
  modelId: string;
  /** Human-readable display name. */
  displayName: string;
  /** Provider identifier. */
  provider: AiProvider;
  /** UI grouping label (e.g. 'Anthropic', 'OpenAI / Codex', 'Google', 'Local'). */
  providerGroup: string;
  /** Short description shown in the model picker tooltip. */
  description?: string;
  /** Hex colour for the UI badge (e.g. '#D97706'). */
  badgeColor: string;
  /** Badge label text (e.g. 'PREMIUM', 'OFFLINE', 'NEW'). */
  badgeLabel?: string;
  /** Whether this is a premium/expensive model. */
  isPremium: boolean;
  /** Whether this model works offline (Ollama). */
  isOffline: boolean;
  /** Whether the model is currently available (provider reachable + key valid). */
  isAvailable: boolean;
  /** Context window size in tokens. */
  contextWindow?: number;
  /** Sort order for display within the provider group. */
  sortOrder: number;
}

/**
 * Payload for MODELS_LIST — sent from Java to Angular.
 * Contains the full catalogue of registered models across all providers.
 */
export interface ModelsListPayload {
  /** All registered models, sorted by providerGroup then sortOrder. */
  models: ModelInfo[];
}

/**
 * Payload for PROVIDER_STATUS — pushed from Java to Angular.
 * Drives the provider health indicators in the settings panel.
 */
export interface ProviderStatusPayload {
  /** Provider identifier. */
  provider: AiProvider;
  /** Whether the provider has a valid API key configured. */
  hasApiKey: boolean;
  /** Whether the provider endpoint is currently reachable. */
  isReachable: boolean;
  /** Display name for the provider (e.g. 'Anthropic', 'OpenAI'). */
  displayName: string;
  /** Number of models available from this provider. */
  modelCount: number;
}

/**
 * Payload for API_KEY_SET — sent from Angular to Java.
 * Stores the API key in the OS keychain via the backend.
 */
export interface ApiKeySetPayload {
  /** Provider to set the key for. */
  provider: AiProvider;
  /** The plain-text API key — never logged or persisted to disk. */
  apiKey: string;
}

/**
 * Payload for API_KEY_TEST — sent from Angular to Java.
 * Requests validation of an API key without persisting it.
 */
export interface ApiKeyTestPayload {
  /** Provider to test. */
  provider: AiProvider;
  /** The API key to validate. */
  apiKey: string;
}

/**
 * Payload for API_KEY_TEST_RESULT — sent from Java to Angular.
 * Reports the outcome of an API key validation request.
 */
export interface ApiKeyTestResultPayload {
  /** Provider that was tested. */
  provider: AiProvider;
  /** Whether the key is valid and accepted by the provider. */
  isValid: boolean;
  /** Human-readable error message when isValid is false. */
  error?: string;
  /** Number of models discovered with this key (when isValid is true). */
  modelsFound?: number;
}

// ---------------------------------------------------------------------------
// Error payload
// ---------------------------------------------------------------------------

/**
 * Payload for CHAT_ERROR and any other error message type.
 * Provides structured error information for display and logging.
 */
export interface ErrorPayload {
  /** Machine-readable error code (e.g. 'MODEL_UNAVAILABLE', 'RATE_LIMIT'). */
  code: string;
  /** Human-readable error description. */
  message: string;
  /** Additional diagnostic details (stack trace, upstream error, etc.). */
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Convenience union types
// ---------------------------------------------------------------------------

/** Union of all possible typed WsMessage variants. */
export type AnyWsMessage =
  | WsMessage<ChatMessagePayload>
  | WsMessage<ChatResponsePayload>
  | WsMessage<StreamChunkPayload>
  | WsMessage<AgentStatusPayload>
  | WsMessage<FileIndexStatusPayload>
  | WsMessage<ErrorPayload>
  | WsMessage<ModelsListPayload>
  | WsMessage<ProviderStatusPayload>
  | WsMessage<ApiKeySetPayload>
  | WsMessage<ApiKeyTestPayload>
  | WsMessage<ApiKeyTestResultPayload>
  | WsMessage<Record<string, never>>; // health ping/pong and models:request (empty payload)
