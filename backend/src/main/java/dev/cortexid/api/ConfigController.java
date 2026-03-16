package dev.cortexid.api;

import dev.cortexid.ai.AiModelConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Configuration REST endpoint.
 * Allows the frontend to set API keys and query available models.
 */
@RestController
@RequestMapping("/api/config")
public class ConfigController {

    private static final Logger log = LoggerFactory.getLogger(ConfigController.class);

    private final AiModelConfig aiModelConfig;

    public ConfigController(AiModelConfig aiModelConfig) {
        this.aiModelConfig = aiModelConfig;
    }

    /**
     * Set the Anthropic API key for this session.
     * The key is stored in memory only — never persisted to disk.
     */
    @PostMapping("/api-key")
    public ResponseEntity<Map<String, String>> setApiKey(@RequestBody Map<String, String> body) {
        String apiKey = body.get("apiKey");
        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "apiKey is required"));
        }

        // Store in memory config (not persisted)
        aiModelConfig.getAnthropic().setApiKey(apiKey);
        log.info("Anthropic API key configured (length: {})", apiKey.length());

        return ResponseEntity.ok(Map.of("status", "ok", "message", "API key configured"));
    }

    /**
     * List available AI models.
     * Returns both Anthropic and Ollama models.
     */
    @GetMapping("/models")
    public ResponseEntity<Map<String, Object>> getModels() {
        List<Map<String, String>> anthropicModels = List.of(
            Map.of("id", "claude-3-5-sonnet-20241022", "name", "Claude 3.5 Sonnet", "provider", "anthropic"),
            Map.of("id", "claude-3-5-haiku-20241022", "name", "Claude 3.5 Haiku", "provider", "anthropic"),
            Map.of("id", "claude-3-haiku-20240307", "name", "Claude 3 Haiku", "provider", "anthropic"),
            Map.of("id", "claude-3-opus-20240229", "name", "Claude 3 Opus", "provider", "anthropic")
        );

        List<Map<String, String>> ollamaModels = List.of(
            Map.of("id", "llama3", "name", "Llama 3", "provider", "ollama"),
            Map.of("id", "codellama", "name", "Code Llama", "provider", "ollama"),
            Map.of("id", "deepseek-coder", "name", "DeepSeek Coder", "provider", "ollama"),
            Map.of("id", "mistral", "name", "Mistral", "provider", "ollama")
        );

        return ResponseEntity.ok(Map.of(
            "defaultModel", aiModelConfig.getDefaultModel(),
            "anthropic", anthropicModels,
            "ollama", ollamaModels
        ));
    }
}
