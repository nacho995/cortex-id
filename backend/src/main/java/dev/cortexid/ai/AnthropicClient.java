package dev.cortexid.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.function.Consumer;

/**
 * HTTP client for the Anthropic Claude API.
 * Supports both streaming (SSE) and non-streaming responses.
 * API key is passed per-request to support Bring Your Own Key.
 */
@Component
public class AnthropicClient {

    private static final Logger log = LoggerFactory.getLogger(AnthropicClient.class);

    /** Default system prompt used when no dynamic prompt is provided. */
    public static final String DEFAULT_SYSTEM_PROMPT = """
        You are Cortex-ID, an AI coding assistant integrated directly into the developer's IDE.
        You help developers write, understand, debug, and refactor code.
        Be concise, precise, and helpful. When showing code, use proper markdown code blocks with language identifiers.
        You have access to the context of the currently open file when provided.
        """;

    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final int MAX_TOKENS = 4096;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AiModelConfig config;

    public AnthropicClient(ObjectMapper objectMapper, AiModelConfig config) {
        this.objectMapper = objectMapper;
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    }

    /**
     * Send a streaming chat request to Claude with a dynamic system prompt.
     *
     * @param messages     Conversation history as [{role, content}]
     * @param model        Model identifier (e.g. "claude-3-haiku-20240307")
     * @param apiKey       Anthropic API key
     * @param systemPrompt Dynamic system prompt with project context
     * @param onChunk      Callback for each streaming text chunk
     * @param onComplete   Callback when streaming is complete
     * @param onError      Callback on error
     */
    public void streamChat(
        List<ConversationMessage> messages,
        String model,
        String apiKey,
        String systemPrompt,
        Consumer<String> onChunk,
        Runnable onComplete,
        Consumer<String> onError
    ) {
        String resolvedModel = (model != null && !model.isBlank()) ? model : config.getDefaultModel();
        String resolvedKey = resolveApiKey(apiKey);
        String resolvedPrompt = (systemPrompt != null && !systemPrompt.isBlank())
            ? systemPrompt : DEFAULT_SYSTEM_PROMPT;

        if (resolvedKey == null || resolvedKey.isBlank()) {
            onError.accept("No Anthropic API key configured. Please set your API key in Settings.");
            return;
        }

        try {
            String requestBody = buildRequestBody(messages, resolvedModel, true, resolvedPrompt);
            log.debug("Sending streaming request to Anthropic, model={}, messages={}", resolvedModel, messages.size());

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getAnthropic().getApiUrl() + "/messages"))
                .header("Content-Type", "application/json")
                .header("x-api-key", resolvedKey)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofMinutes(5))
                .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream())
                .thenAccept(response -> {
                    if (response.statusCode() != 200) {
                        try {
                            String errorBody = new String(response.body().readAllBytes());
                            log.error("Anthropic API error {}: {}", response.statusCode(), errorBody);
                            onError.accept("Anthropic API error " + response.statusCode() + ": " + extractErrorMessage(errorBody));
                        } catch (Exception e) {
                            onError.accept("Anthropic API error: " + response.statusCode());
                        }
                        return;
                    }

                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body()))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (line.startsWith("data: ")) {
                                String data = line.substring(6).trim();
                                if (data.equals("[DONE]")) break;
                                processStreamEvent(data, onChunk);
                            }
                        }
                        onComplete.run();
                    } catch (Exception e) {
                        log.error("Error reading streaming response: {}", e.getMessage(), e);
                        onError.accept("Error reading AI response: " + e.getMessage());
                    }
                })
                .exceptionally(e -> {
                    log.error("HTTP request failed: {}", e.getMessage(), e);
                    onError.accept("Connection error: " + e.getMessage());
                    return null;
                });

        } catch (Exception e) {
            log.error("Failed to build Anthropic request: {}", e.getMessage(), e);
            onError.accept("Failed to send request: " + e.getMessage());
        }
    }

    /**
     * Send a non-streaming chat request to Claude.
     * Returns the complete response text.
     */
    public String chat(List<ConversationMessage> messages, String model, String apiKey) {
        String resolvedModel = (model != null && !model.isBlank()) ? model : config.getDefaultModel();
        String resolvedKey = resolveApiKey(apiKey);

        if (resolvedKey == null || resolvedKey.isBlank()) {
            throw new IllegalStateException("No Anthropic API key configured");
        }

        try {
            String requestBody = buildRequestBody(messages, resolvedModel, false, DEFAULT_SYSTEM_PROMPT);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getAnthropic().getApiUrl() + "/messages"))
                .header("Content-Type", "application/json")
                .header("x-api-key", resolvedKey)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofMinutes(2))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new RuntimeException("Anthropic API error " + response.statusCode() + ": " + response.body());
            }

            JsonNode root = objectMapper.readTree(response.body());
            return root.path("content").get(0).path("text").asText();

        } catch (Exception e) {
            log.error("Anthropic chat request failed: {}", e.getMessage(), e);
            throw new RuntimeException("AI request failed: " + e.getMessage(), e);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String buildRequestBody(List<ConversationMessage> messages, String model, boolean stream, String systemPrompt) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", MAX_TOKENS);
        body.put("system", systemPrompt);
        body.put("stream", stream);

        ArrayNode messagesNode = body.putArray("messages");
        for (ConversationMessage msg : messages) {
            ObjectNode msgNode = messagesNode.addObject();
            msgNode.put("role", msg.role());
            msgNode.put("content", msg.content());
        }

        return objectMapper.writeValueAsString(body);
    }

    private void processStreamEvent(String data, Consumer<String> onChunk) {
        try {
            JsonNode event = objectMapper.readTree(data);
            String eventType = event.path("type").asText();

            if ("content_block_delta".equals(eventType)) {
                JsonNode delta = event.path("delta");
                if ("text_delta".equals(delta.path("type").asText())) {
                    String text = delta.path("text").asText();
                    if (!text.isEmpty()) {
                        onChunk.accept(text);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not parse SSE event: {}", data);
        }
    }

    private String extractErrorMessage(String errorBody) {
        try {
            JsonNode root = objectMapper.readTree(errorBody);
            return root.path("error").path("message").asText(errorBody);
        } catch (Exception e) {
            return errorBody;
        }
    }

    private String resolveApiKey(String requestApiKey) {
        if (requestApiKey != null && !requestApiKey.isBlank()) return requestApiKey;
        return config.getAnthropic().getApiKey();
    }

    /**
     * Simple conversation message record for building API requests.
     */
    public record ConversationMessage(String role, String content) {}
}
