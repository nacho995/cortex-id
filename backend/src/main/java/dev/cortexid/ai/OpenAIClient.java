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
 * HTTP client for the OpenAI / Codex API.
 * Supports streaming (SSE) responses via /v1/chat/completions.
 * Handles models: gpt-4o, gpt-4o-mini, o3, o4-mini, codex-mini-latest.
 */
@Component
public class OpenAIClient {

    private static final Logger log = LoggerFactory.getLogger(OpenAIClient.class);

    /** Default system prompt used when no dynamic prompt is provided. */
    public static final String DEFAULT_SYSTEM_PROMPT = """
        You are Cortex-ID, an AI coding assistant integrated directly into the developer's IDE.
        You help developers write, understand, debug, and refactor code.
        Be concise, precise, and helpful. When showing code, use proper markdown code blocks with language identifiers.
        You have access to the context of the currently open file when provided.
        """;

    private static final int MAX_TOKENS = 4096;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AiModelConfig config;

    public OpenAIClient(ObjectMapper objectMapper, AiModelConfig config) {
        this.objectMapper = objectMapper;
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    }

    /**
     * Send a streaming chat request to OpenAI with a dynamic system prompt.
     *
     * @param messages     Conversation history
     * @param model        Model identifier (e.g. "gpt-4o", "codex-mini-latest")
     * @param apiKey       OpenAI API key
     * @param systemPrompt Dynamic system prompt with project context
     * @param onChunk      Callback for each streaming text chunk
     * @param onComplete   Callback when streaming is complete
     * @param onError      Callback on error
     */
    public void streamChat(
        List<AnthropicClient.ConversationMessage> messages,
        String model,
        String apiKey,
        String systemPrompt,
        Consumer<String> onChunk,
        Runnable onComplete,
        Consumer<String> onError
    ) {
        String resolvedKey = resolveApiKey(apiKey);
        String resolvedPrompt = (systemPrompt != null && !systemPrompt.isBlank())
            ? systemPrompt : DEFAULT_SYSTEM_PROMPT;

        if (resolvedKey == null || resolvedKey.isBlank()) {
            onError.accept("No OpenAI API key configured. Please set your API key in Settings → AI Providers.");
            return;
        }

        try {
            String requestBody = buildRequestBody(messages, model, true, resolvedPrompt);
            log.debug("Sending streaming request to OpenAI, model={}, messages={}", model, messages.size());

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getOpenai().getApiUrl() + "/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + resolvedKey)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofMinutes(5))
                .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream())
                .thenAccept(response -> {
                    if (response.statusCode() != 200) {
                        try {
                            String errorBody = new String(response.body().readAllBytes());
                            log.error("OpenAI API error {}: {}", response.statusCode(), errorBody);
                            onError.accept("OpenAI API error " + response.statusCode() + ": " + extractErrorMessage(errorBody));
                        } catch (Exception e) {
                            onError.accept("OpenAI API error: " + response.statusCode());
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
                        log.error("Error reading OpenAI streaming response: {}", e.getMessage(), e);
                        onError.accept("Error reading OpenAI response: " + e.getMessage());
                    }
                })
                .exceptionally(e -> {
                    log.error("OpenAI HTTP request failed: {}", e.getMessage(), e);
                    onError.accept("OpenAI connection error: " + e.getMessage());
                    return null;
                });

        } catch (Exception e) {
            log.error("Failed to build OpenAI request: {}", e.getMessage(), e);
            onError.accept("Failed to send OpenAI request: " + e.getMessage());
        }
    }

    /**
     * Test if the given API key is valid by listing models.
     *
     * @param apiKey OpenAI API key to test
     * @return true if the key is valid and the API responds with 200
     */
    public boolean isKeyValid(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return false;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getOpenai().getApiUrl() + "/models"))
                .header("Authorization", "Bearer " + apiKey)
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.debug("OpenAI key validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * List available OpenAI models using the given API key.
     * Returns raw JSON response body, or null on failure.
     */
    public String listModels(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return null;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getOpenai().getApiUrl() + "/models"))
                .header("Authorization", "Bearer " + apiKey)
                .GET()
                .timeout(Duration.ofSeconds(15))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) return response.body();
            log.warn("OpenAI list models returned {}", response.statusCode());
            return null;
        } catch (Exception e) {
            log.debug("OpenAI list models failed: {}", e.getMessage());
            return null;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String buildRequestBody(
        List<AnthropicClient.ConversationMessage> messages,
        String model,
        boolean stream,
        String systemPrompt
    ) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("max_tokens", MAX_TOKENS);
        body.put("stream", stream);

        ArrayNode messagesNode = body.putArray("messages");

        // System message first
        ObjectNode systemMsg = messagesNode.addObject();
        systemMsg.put("role", "system");
        systemMsg.put("content", systemPrompt);

        for (AnthropicClient.ConversationMessage msg : messages) {
            ObjectNode msgNode = messagesNode.addObject();
            msgNode.put("role", msg.role());
            msgNode.put("content", msg.content());
        }

        return objectMapper.writeValueAsString(body);
    }

    private void processStreamEvent(String data, Consumer<String> onChunk) {
        try {
            JsonNode event = objectMapper.readTree(data);
            JsonNode choices = event.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                JsonNode delta = choices.get(0).path("delta");
                String content = delta.path("content").asText();
                if (!content.isEmpty()) {
                    onChunk.accept(content);
                }
            }
        } catch (Exception e) {
            log.debug("Could not parse OpenAI SSE event: {}", data);
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
        return config.getOpenai().getApiKey();
    }
}
