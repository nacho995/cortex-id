package dev.cortexid.websocket;

/**
 * WebSocket event type constants.
 * Must stay in sync with WS_EVENTS in shared-types/src/ws/events.ts
 * and WsMessageType enum in messages.types.ts.
 *
 * Convention: '<domain>:<action>'
 */
public final class WsMessageTypes {

    private WsMessageTypes() {}

    // ── Chat ──────────────────────────────────────────────────────────────────
    /** Angular → Java: User sends a chat message. Payload: ChatMessagePayload */
    public static final String CHAT_MESSAGE = "chat:message";

    /** Java → Angular: Complete (non-streaming) AI response. */
    public static final String CHAT_RESPONSE = "chat:response";

    /** Java → Angular: Streaming response begins. */
    public static final String CHAT_STREAM_START = "chat:stream-start";

    /** Java → Angular: Incremental streaming chunk. */
    public static final String CHAT_STREAM_CHUNK = "chat:stream-chunk";

    /** Java → Angular: Streaming response complete. */
    public static final String CHAT_STREAM_END = "chat:stream-end";

    /** Java → Angular: Error during AI processing. */
    public static final String CHAT_ERROR = "chat:error";

    // ── Agents ────────────────────────────────────────────────────────────────
    /** Java → Angular: Agent lifecycle state change. */
    public static final String AGENT_STATUS = "agent:status";

    /** Java → Angular: Agent task progress update. */
    public static final String AGENT_PROGRESS = "agent:progress";

    // ── File Indexer ──────────────────────────────────────────────────────────
    /** Java → Angular: Indexing progress update. */
    public static final String FILE_INDEX_STATUS = "file:index-status";

    /** Java → Angular: Indexing finished. */
    public static final String FILE_INDEX_COMPLETE = "file:index-complete";

    // ── Health ────────────────────────────────────────────────────────────────
    /** Angular → Java: Heartbeat ping. */
    public static final String HEALTH_PING = "health:ping";

    /** Java → Angular: Heartbeat pong. */
    public static final String HEALTH_PONG = "health:pong";

    // ── Models ────────────────────────────────────────────────────────────────
    /** Angular → Java: Request available model list. */
    public static final String MODELS_REQUEST = "models:request";

    /** Java → Angular: Full list of available models. */
    public static final String MODELS_LIST = "models:list";

    /** Java → Angular: Model registry was refreshed (push notification). */
    public static final String MODELS_UPDATED = "models:updated";

    // ── Provider status ───────────────────────────────────────────────────────
    /** Java → Angular: Provider availability status. */
    public static final String PROVIDER_STATUS = "provider:status";

    // ── Config / API Keys ─────────────────────────────────────────────────────
    /** Angular → Java: Set an API key for a provider. Payload: {provider, apiKey} */
    public static final String API_KEY_SET = "config:api-key-set";

    /** Angular → Java: Test an API key for a provider. Payload: {provider, apiKey} */
    public static final String API_KEY_TEST = "config:api-key-test";

    /** Java → Angular: Result of an API key test. Payload: {provider, valid, message} */
    public static final String API_KEY_TEST_RESULT = "config:api-key-test-result";
}
