package dev.cortexid.websocket;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.cortexid.ai.AiModelConfig;
import dev.cortexid.ai.AnthropicClient;
import dev.cortexid.ai.GoogleClient;
import dev.cortexid.ai.OpenAIClient;
import dev.cortexid.ai.models.ModelInfo;
import dev.cortexid.ai.models.ModelRegistryService;
import dev.cortexid.ai.orchestrator.ChatMessagePayload;
import dev.cortexid.ai.orchestrator.OrchestrationService;
import dev.cortexid.indexer.FileIndexer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.List;
import java.util.Map;

/**
 * Main WebSocket handler for Cortex-ID.
 * Routes incoming messages by type to the appropriate service.
 * Manages session lifecycle.
 */
@Component
public class CortexWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CortexWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final SessionRegistry sessionRegistry;
    private final OrchestrationService orchestrationService;
    private final FileIndexer fileIndexer;
    private final ModelRegistryService modelRegistryService;
    private final AiModelConfig aiModelConfig;
    private final AnthropicClient anthropicClient;
    private final OpenAIClient openAIClient;
    private final GoogleClient googleClient;

    public CortexWebSocketHandler(
        ObjectMapper objectMapper,
        SessionRegistry sessionRegistry,
        OrchestrationService orchestrationService,
        FileIndexer fileIndexer,
        ModelRegistryService modelRegistryService,
        AiModelConfig aiModelConfig,
        AnthropicClient anthropicClient,
        OpenAIClient openAIClient,
        GoogleClient googleClient
    ) {
        this.objectMapper = objectMapper;
        this.sessionRegistry = sessionRegistry;
        this.orchestrationService = orchestrationService;
        this.fileIndexer = fileIndexer;
        this.modelRegistryService = modelRegistryService;
        this.aiModelConfig = aiModelConfig;
        this.anthropicClient = anthropicClient;
        this.openAIClient = openAIClient;
        this.googleClient = googleClient;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessionRegistry.register(session);
        log.info("WebSocket connection established: {} (total sessions: {})",
            session.getId(), sessionRegistry.count());

        // Send immediate pong to confirm connection
        WsMessage<Map<String, Object>> pong = WsMessage.create(
            WsMessageTypes.HEALTH_PONG, Map.of("connected", true));
        sessionRegistry.sendTo(session, pong);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessionRegistry.unregister(session);
        log.info("WebSocket connection closed: {} status={} (remaining: {})",
            session.getId(), status, sessionRegistry.count());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String payload = message.getPayload();
        log.debug("Received message from {}: {}",
            session.getId(), payload.length() > 200 ? payload.substring(0, 200) + "..." : payload);

        try {
            JsonNode root = objectMapper.readTree(payload);
            String type = root.path("type").asText();

            switch (type) {
                case WsMessageTypes.HEALTH_PING    -> handlePing(session, root);
                case WsMessageTypes.CHAT_MESSAGE   -> handleChatMessage(session, root);
                case WsMessageTypes.MODELS_REQUEST -> handleModelsRequest(session);
                case WsMessageTypes.API_KEY_SET    -> handleApiKeySet(session, root);
                case WsMessageTypes.API_KEY_TEST   -> handleApiKeyTest(session, root);
                default -> log.warn("Unknown message type '{}' from session {}", type, session.getId());
            }
        } catch (Exception e) {
            log.error("Error processing message from session {}: {}", session.getId(), e.getMessage(), e);
            sendError(session, "PARSE_ERROR", "Failed to process message: " + e.getMessage());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("WebSocket transport error for session {}: {}", session.getId(), exception.getMessage());
        sessionRegistry.unregister(session);
    }

    // ── Message Handlers ──────────────────────────────────────────────────────

    private void handlePing(WebSocketSession session, JsonNode root) {
        String id = root.path("id").asText(java.util.UUID.randomUUID().toString());
        WsMessage<Map<String, Object>> pong = WsMessage.of(
            WsMessageTypes.HEALTH_PONG, id, Map.of());
        sessionRegistry.sendTo(session, pong);
        log.debug("Ping/pong with session {}", session.getId());
    }

    private void handleChatMessage(WebSocketSession session, JsonNode root) {
        try {
            WsMessage<ChatMessagePayload> msg = objectMapper.readValue(
                root.toString(),
                new TypeReference<WsMessage<ChatMessagePayload>>() {}
            );
            log.info("Chat message from session {}: conversationId={}",
                session.getId(), msg.payload().conversationId());
            orchestrationService.handleChatMessage(session, msg);
        } catch (Exception e) {
            log.error("Error handling chat message: {}", e.getMessage(), e);
            sendError(session, "CHAT_ERROR", "Failed to process chat message: " + e.getMessage());
        }
    }

    /**
     * Handle models:request — return the full list of registered models.
     */
    private void handleModelsRequest(WebSocketSession session) {
        try {
            List<ModelInfo> models = modelRegistryService.getAllModels();
            log.debug("Sending model list to session {}: {} models", session.getId(), models.size());
            sessionRegistry.sendTo(session, WsMessage.create(
                WsMessageTypes.MODELS_LIST,
                Map.of("models", models)
            ));
        } catch (Exception e) {
            log.error("Error handling models request: {}", e.getMessage(), e);
            sendError(session, "MODELS_ERROR", "Failed to retrieve model list: " + e.getMessage());
        }
    }

    /**
     * Handle config:api-key-set — store the API key in memory and trigger a model refresh.
     * Payload: {"provider": "anthropic"|"openai"|"google", "apiKey": "sk-..."}
     */
    private void handleApiKeySet(WebSocketSession session, JsonNode root) {
        try {
            JsonNode payload = root.path("payload");
            String provider = payload.path("provider").asText();
            String apiKey = payload.path("apiKey").asText();

            if (provider.isBlank() || apiKey.isBlank()) {
                sendError(session, "INVALID_PAYLOAD", "provider and apiKey are required");
                return;
            }

            switch (provider.toLowerCase()) {
                case "anthropic" -> aiModelConfig.getAnthropic().setApiKey(apiKey);
                case "openai"    -> aiModelConfig.getOpenai().setApiKey(apiKey);
                case "google"    -> aiModelConfig.getGoogle().setApiKey(apiKey);
                default -> {
                    sendError(session, "UNKNOWN_PROVIDER", "Unknown provider: " + provider);
                    return;
                }
            }

            log.info("API key set for provider '{}' from session {}", provider, session.getId());

            // Trigger async model refresh after key is set
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    modelRegistryService.refreshModelsFromProviders();
                    sessionRegistry.sendTo(session, WsMessage.create(
                        WsMessageTypes.MODELS_UPDATED,
                        Map.of("provider", provider, "message", "Models refreshed after key update")
                    ));
                } catch (Exception e) {
                    log.warn("Model refresh after key set failed: {}", e.getMessage());
                }
            });

            sessionRegistry.sendTo(session, WsMessage.create(
                WsMessageTypes.PROVIDER_STATUS,
                Map.of("provider", provider, "status", "key_set", "message", "API key saved successfully")
            ));

        } catch (Exception e) {
            log.error("Error handling api-key-set: {}", e.getMessage(), e);
            sendError(session, "CONFIG_ERROR", "Failed to set API key: " + e.getMessage());
        }
    }

    /**
     * Handle config:api-key-test — validate the API key with the provider.
     * Payload: {"provider": "anthropic"|"openai"|"google", "apiKey": "sk-..."}
     */
    private void handleApiKeyTest(WebSocketSession session, JsonNode root) {
        try {
            JsonNode payload = root.path("payload");
            String provider = payload.path("provider").asText();
            String apiKey = payload.path("apiKey").asText();

            if (provider.isBlank() || apiKey.isBlank()) {
                sendError(session, "INVALID_PAYLOAD", "provider and apiKey are required");
                return;
            }

            log.info("Testing API key for provider '{}' from session {}", provider, session.getId());

            // Run validation asynchronously to avoid blocking the WebSocket thread
            java.util.concurrent.CompletableFuture.runAsync(() -> {
                boolean valid;
                String message;

                try {
                    valid = switch (provider.toLowerCase()) {
                        case "anthropic" -> testAnthropicKey(apiKey);
                        case "openai"    -> openAIClient.isKeyValid(apiKey);
                        case "google"    -> googleClient.isKeyValid(apiKey);
                        default -> {
                            sessionRegistry.sendTo(session, WsMessage.create(
                                WsMessageTypes.API_KEY_TEST_RESULT,
                                Map.of("provider", provider, "isValid", false, "error", "Unknown provider: " + provider)
                            ));
                            yield false;
                        }
                    };
                    message = valid ? "API key is valid" : "API key is invalid or has insufficient permissions";
                } catch (Exception e) {
                    log.warn("API key test failed for provider {}: {}", provider, e.getMessage());
                    valid = false;
                    message = "Connection error: " + e.getMessage();
                }

                sessionRegistry.sendTo(session, WsMessage.create(
                    WsMessageTypes.API_KEY_TEST_RESULT,
                    valid
                        ? Map.of("provider", provider, "isValid", true)
                        : Map.of("provider", provider, "isValid", false, "error", message)
                ));
            });

        } catch (Exception e) {
            log.error("Error handling api-key-test: {}", e.getMessage(), e);
            sendError(session, "CONFIG_ERROR", "Failed to test API key: " + e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Test Anthropic key by making a minimal 1-token request.
     * Anthropic has no dedicated key validation endpoint.
     */
    private boolean testAnthropicKey(String apiKey) {
        try {
            // Use a minimal chat request to verify the key
            List<AnthropicClient.ConversationMessage> testMessages = List.of(
                new AnthropicClient.ConversationMessage("user", "Hi")
            );
            // If no exception is thrown and we get a response, key is valid
            String response = anthropicClient.chat(testMessages, "claude-haiku-4-5", apiKey);
            return response != null && !response.isBlank();
        } catch (Exception e) {
            log.debug("Anthropic key test failed: {}", e.getMessage());
            return false;
        }
    }

    private void sendError(WebSocketSession session, String code, String message) {
        WsMessage<Map<String, Object>> errorMsg = WsMessage.create(
            WsMessageTypes.CHAT_ERROR,
            Map.of("code", code, "message", message)
        );
        sessionRegistry.sendTo(session, errorMsg);
    }
}
