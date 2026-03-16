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
 * HTTP client for the Ollama local AI API.
 * Used as a fallback when no Anthropic API key is configured.
 * Supports streaming responses via Ollama's /api/chat endpoint.
 */
@Component
public class OllamaClient {

    private static final Logger log = LoggerFactory.getLogger(OllamaClient.class);

    private static final String DEFAULT_MODEL = "llama3";
    private static final String SYSTEM_PROMPT = """
        You are Cortex-ID, an AI coding assistant integrated directly into the developer's IDE.
        You help developers write, understand, debug, and refactor code.
        Be concise, precise, and helpful. When showing code, use proper markdown code blocks.
        """;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final AiModelConfig config;

    public OllamaClient(ObjectMapper objectMapper, AiModelConfig config) {
        this.objectMapper = objectMapper;
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    /**
     * Check if Ollama is available at the configured URL.
     */
    public boolean isAvailable() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getOllama().getApiUrl() + "/api/tags"))
                .GET()
                .timeout(Duration.ofSeconds(3))
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.debug("Ollama not available: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Send a streaming chat request to Ollama.
     *
     * @param messages   Conversation history
     * @param model      Model name (e.g. "llama3", "codellama")
     * @param onChunk    Callback for each streaming text chunk
     * @param onComplete Callback when streaming is complete
     * @param onError    Callback on error
     */
    public void streamChat(
        List<AnthropicClient.ConversationMessage> messages,
        String model,
        Consumer<String> onChunk,
        Runnable onComplete,
        Consumer<String> onError
    ) {
        String resolvedModel = (model != null && !model.isBlank()) ? model : DEFAULT_MODEL;

        try {
            String requestBody = buildRequestBody(messages, resolvedModel);
            log.debug("Sending streaming request to Ollama, model={}", resolvedModel);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getOllama().getApiUrl() + "/api/chat"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofMinutes(5))
                .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream())
                .thenAccept(response -> {
                    if (response.statusCode() != 200) {
                        onError.accept("Ollama API error: " + response.statusCode());
                        return;
                    }

                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body()))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (!line.isBlank()) {
                                processStreamLine(line, onChunk);
                            }
                        }
                        onComplete.run();
                    } catch (Exception e) {
                        log.error("Error reading Ollama streaming response: {}", e.getMessage(), e);
                        onError.accept("Error reading Ollama response: " + e.getMessage());
                    }
                })
                .exceptionally(e -> {
                    log.error("Ollama HTTP request failed: {}", e.getMessage(), e);
                    onError.accept("Ollama connection error: " + e.getMessage());
                    return null;
                });

        } catch (Exception e) {
            log.error("Failed to build Ollama request: {}", e.getMessage(), e);
            onError.accept("Failed to send Ollama request: " + e.getMessage());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String buildRequestBody(List<AnthropicClient.ConversationMessage> messages, String model) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", model);
        body.put("stream", true);

        ArrayNode messagesNode = body.putArray("messages");

        // Add system message first
        ObjectNode systemMsg = messagesNode.addObject();
        systemMsg.put("role", "system");
        systemMsg.put("content", SYSTEM_PROMPT);

        for (AnthropicClient.ConversationMessage msg : messages) {
            ObjectNode msgNode = messagesNode.addObject();
            msgNode.put("role", msg.role());
            msgNode.put("content", msg.content());
        }

        return objectMapper.writeValueAsString(body);
    }

    private void processStreamLine(String line, Consumer<String> onChunk) {
        try {
            JsonNode event = objectMapper.readTree(line);
            JsonNode message = event.path("message");
            if (!message.isMissingNode()) {
                String content = message.path("content").asText();
                if (!content.isEmpty()) {
                    onChunk.accept(content);
                }
            }
        } catch (Exception e) {
            log.debug("Could not parse Ollama stream line: {}", line);
        }
    }
}
