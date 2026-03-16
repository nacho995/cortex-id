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
 * HTTP client for the Google Gemini API.
 * Supports streaming (SSE) responses via streamGenerateContent.
 * Handles models: gemini-2.5-pro, gemini-2.5-flash.
 */
@Component
public class GoogleClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleClient.class);

    /** Default system prompt used when no dynamic prompt is provided. */
    public static final String DEFAULT_SYSTEM_PROMPT = """
        You are Cortex-ID, an AI coding assistant integrated directly into the developer's IDE.
        You help developers write, understand, debug, and refactor code.
        Be concise, precise, and helpful. When showing code, use proper markdown code blocks with language identifiers.
        You have access to the context of the currently open file when provided.
        """;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AiModelConfig config;

    public GoogleClient(ObjectMapper objectMapper, AiModelConfig config) {
        this.objectMapper = objectMapper;
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    }

    /**
     * Send a streaming chat request to Google Gemini with a dynamic system prompt.
     *
     * @param messages     Conversation history
     * @param model        Model identifier (e.g. "gemini-2.5-pro")
     * @param apiKey       Google API key
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
            onError.accept("No Google API key configured. Please set your API key in Settings → AI Providers.");
            return;
        }

        try {
            String requestBody = buildRequestBody(messages, resolvedPrompt);
            String url = config.getGoogle().getApiUrl()
                + "/models/" + model + ":streamGenerateContent?key=" + resolvedKey + "&alt=sse";

            log.debug("Sending streaming request to Google Gemini, model={}, messages={}", model, messages.size());

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofMinutes(5))
                .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream())
                .thenAccept(response -> {
                    if (response.statusCode() != 200) {
                        try {
                            String errorBody = new String(response.body().readAllBytes());
                            log.error("Google Gemini API error {}: {}", response.statusCode(), errorBody);
                            onError.accept("Google Gemini API error " + response.statusCode() + ": " + extractErrorMessage(errorBody));
                        } catch (Exception e) {
                            onError.accept("Google Gemini API error: " + response.statusCode());
                        }
                        return;
                    }

                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body()))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (line.startsWith("data: ")) {
                                String data = line.substring(6).trim();
                                if (!data.isBlank()) {
                                    processStreamEvent(data, onChunk);
                                }
                            }
                        }
                        onComplete.run();
                    } catch (Exception e) {
                        log.error("Error reading Google Gemini streaming response: {}", e.getMessage(), e);
                        onError.accept("Error reading Google Gemini response: " + e.getMessage());
                    }
                })
                .exceptionally(e -> {
                    log.error("Google Gemini HTTP request failed: {}", e.getMessage(), e);
                    onError.accept("Google Gemini connection error: " + e.getMessage());
                    return null;
                });

        } catch (Exception e) {
            log.error("Failed to build Google Gemini request: {}", e.getMessage(), e);
            onError.accept("Failed to send Google Gemini request: " + e.getMessage());
        }
    }

    /**
     * Test if the given API key is valid by listing models.
     *
     * @param apiKey Google API key to test
     * @return true if the key is valid and the API responds with 200
     */
    public boolean isKeyValid(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return false;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getGoogle().getApiUrl() + "/models?key=" + apiKey))
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.debug("Google key validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * List available Google Gemini models using the given API key.
     * Returns raw JSON response body, or null on failure.
     */
    public String listModels(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return null;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getGoogle().getApiUrl() + "/models?key=" + apiKey))
                .GET()
                .timeout(Duration.ofSeconds(15))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) return response.body();
            log.warn("Google list models returned {}", response.statusCode());
            return null;
        } catch (Exception e) {
            log.debug("Google list models failed: {}", e.getMessage());
            return null;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String buildRequestBody(List<AnthropicClient.ConversationMessage> messages, String systemPrompt) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();

        // System instruction
        ObjectNode systemInstruction = body.putObject("systemInstruction");
        ArrayNode systemParts = systemInstruction.putArray("parts");
        systemParts.addObject().put("text", systemPrompt);

        // Contents (conversation history)
        ArrayNode contents = body.putArray("contents");
        for (AnthropicClient.ConversationMessage msg : messages) {
            ObjectNode content = contents.addObject();
            // Gemini uses "user" and "model" roles (not "assistant")
            content.put("role", "assistant".equals(msg.role()) ? "model" : msg.role());
            ArrayNode parts = content.putArray("parts");
            parts.addObject().put("text", msg.content());
        }

        return objectMapper.writeValueAsString(body);
    }

    private void processStreamEvent(String data, Consumer<String> onChunk) {
        try {
            JsonNode event = objectMapper.readTree(data);
            JsonNode candidates = event.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode content = candidates.get(0).path("content");
                JsonNode parts = content.path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    String text = parts.get(0).path("text").asText();
                    if (!text.isEmpty()) {
                        onChunk.accept(text);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not parse Google Gemini SSE event: {}", data);
        }
    }

    private String extractErrorMessage(String errorBody) {
        try {
            JsonNode root = objectMapper.readTree(errorBody);
            // Google error format: {"error": {"code": 400, "message": "...", "status": "..."}}
            JsonNode error = root.path("error");
            if (!error.isMissingNode()) {
                return error.path("message").asText(errorBody);
            }
            return errorBody;
        } catch (Exception e) {
            return errorBody;
        }
    }

    private String resolveApiKey(String requestApiKey) {
        if (requestApiKey != null && !requestApiKey.isBlank()) return requestApiKey;
        return config.getGoogle().getApiKey();
    }
}
