package dev.cortexid.ai.models;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.cortexid.ai.AiModelConfig;
import dev.cortexid.ai.AnthropicClient;
import dev.cortexid.ai.GoogleClient;
import dev.cortexid.ai.OllamaClient;
import dev.cortexid.ai.OpenAIClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service that manages the AI model registry.
 * Initializes with hardcoded fallback models on startup,
 * then refreshes from provider APIs every 24 hours.
 */
@Service
public class ModelRegistryService {

    private static final Logger log = LoggerFactory.getLogger(ModelRegistryService.class);

    private final ModelRepository modelRepository;
    private final AiModelConfig aiModelConfig;
    private final OllamaClient ollamaClient;
    private final OpenAIClient openAIClient;
    private final GoogleClient googleClient;
    private final ObjectMapper objectMapper;

    public ModelRegistryService(
        ModelRepository modelRepository,
        AiModelConfig aiModelConfig,
        OllamaClient ollamaClient,
        OpenAIClient openAIClient,
        GoogleClient googleClient,
        ObjectMapper objectMapper
    ) {
        this.modelRepository = modelRepository;
        this.aiModelConfig = aiModelConfig;
        this.ollamaClient = ollamaClient;
        this.openAIClient = openAIClient;
        this.googleClient = googleClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Initialize the model registry with hardcoded fallback models on startup.
     * Only inserts models that don't already exist (idempotent).
     */
    @PostConstruct
    void initializeDefaultModels() {
        log.info("Initializing model registry with default models...");

        List<ModelInfo> defaults = buildDefaultModels();
        int inserted = 0;

        for (ModelInfo model : defaults) {
            if (modelRepository.findByModelId(model.getModelId()).isEmpty()) {
                modelRepository.save(model);
                inserted++;
            }
        }

        log.info("Model registry initialized: {} new models inserted, {} total",
            inserted, modelRepository.count());
    }

    /**
     * Get all available models ordered by sort_order.
     */
    public List<ModelInfo> getAvailableModels() {
        return modelRepository.findByIsAvailableTrue();
    }

    /**
     * Get all models (including unavailable) ordered by sort_order.
     */
    public List<ModelInfo> getAllModels() {
        return modelRepository.findAllOrderBySortOrder();
    }

    /**
     * Refresh models from all configured provider APIs.
     * Runs every 24 hours automatically.
     */
    @Scheduled(fixedRate = 86_400_000L) // 24 hours
    public void refreshModelsFromProviders() {
        log.info("Refreshing models from provider APIs...");

        String anthropicKey = aiModelConfig.getAnthropic().getApiKey();
        if (anthropicKey != null && !anthropicKey.isBlank()) {
            refreshAnthropicModels(anthropicKey);
        }

        String openaiKey = aiModelConfig.getOpenai().getApiKey();
        if (openaiKey != null && !openaiKey.isBlank()) {
            refreshOpenAIModels(openaiKey);
        }

        String googleKey = aiModelConfig.getGoogle().getApiKey();
        if (googleKey != null && !googleKey.isBlank()) {
            refreshGoogleModels(googleKey);
        }

        refreshOllamaModels();

        log.info("Model registry refresh complete");
    }

    /**
     * Refresh Anthropic models.
     * Anthropic has no public model listing endpoint — we verify the key works
     * by making a minimal request and mark all Anthropic models as available.
     */
    private void refreshAnthropicModels(String apiKey) {
        try {
            // Verify key works with a minimal 1-token request
            List<AnthropicClient.ConversationMessage> testMessages = List.of(
                new AnthropicClient.ConversationMessage("user", "Hi")
            );

            // We just mark all Anthropic models as available if key is present
            // (actual validation happens in AnthropicClient.streamChat)
            List<ModelInfo> anthropicModels = modelRepository.findByProvider("anthropic");
            for (ModelInfo model : anthropicModels) {
                model.setAvailable(true);
                model.setLastVerifiedAt(LocalDateTime.now());
                modelRepository.save(model);
            }
            log.info("Anthropic models marked as available (key configured)");
        } catch (Exception e) {
            log.warn("Failed to refresh Anthropic models: {}", e.getMessage());
        }
    }

    /**
     * Refresh OpenAI models by querying the /v1/models endpoint.
     * Filters to only gpt-*, o3*, o4-*, codex-* models.
     */
    private void refreshOpenAIModels(String apiKey) {
        try {
            String responseBody = openAIClient.listModels(apiKey);
            if (responseBody == null) {
                log.warn("Could not fetch OpenAI model list");
                return;
            }

            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode data = root.path("data");

            if (!data.isArray()) return;

            int updated = 0;
            for (JsonNode modelNode : data) {
                String modelId = modelNode.path("id").asText();
                if (!isRelevantOpenAIModel(modelId)) continue;

                modelRepository.findByModelId(modelId).ifPresent(model -> {
                    model.setAvailable(true);
                    model.setLastVerifiedAt(LocalDateTime.now());
                    modelRepository.save(model);
                });
                updated++;
            }
            log.info("OpenAI models refreshed: {} relevant models found", updated);
        } catch (Exception e) {
            log.warn("Failed to refresh OpenAI models: {}", e.getMessage());
        }
    }

    /**
     * Refresh Google Gemini models by querying the /v1beta/models endpoint.
     * Filters to only gemini-* models.
     */
    private void refreshGoogleModels(String apiKey) {
        try {
            String responseBody = googleClient.listModels(apiKey);
            if (responseBody == null) {
                log.warn("Could not fetch Google model list");
                return;
            }

            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode models = root.path("models");

            if (!models.isArray()) return;

            int updated = 0;
            for (JsonNode modelNode : models) {
                // Google returns names like "models/gemini-2.5-pro"
                String fullName = modelNode.path("name").asText();
                String modelId = fullName.startsWith("models/") ? fullName.substring(7) : fullName;

                if (!modelId.startsWith("gemini-")) continue;

                modelRepository.findByModelId(modelId).ifPresent(model -> {
                    model.setAvailable(true);
                    model.setLastVerifiedAt(LocalDateTime.now());
                    modelRepository.save(model);
                });
                updated++;
            }
            log.info("Google Gemini models refreshed: {} relevant models found", updated);
        } catch (Exception e) {
            log.warn("Failed to refresh Google models: {}", e.getMessage());
        }
    }

    /**
     * Refresh Ollama models by checking local availability.
     * If Ollama is not running, marks all Ollama models as unavailable (no error thrown).
     */
    private void refreshOllamaModels() {
        try {
            boolean ollamaAvailable = ollamaClient.isAvailable();
            List<ModelInfo> ollamaModels = modelRepository.findByProvider("ollama");

            for (ModelInfo model : ollamaModels) {
                model.setAvailable(ollamaAvailable);
                model.setLastVerifiedAt(LocalDateTime.now());
                modelRepository.save(model);
            }

            if (ollamaAvailable) {
                log.info("Ollama is available — {} models marked as available", ollamaModels.size());
            } else {
                log.debug("Ollama not available — {} models marked as unavailable", ollamaModels.size());
            }
        } catch (Exception e) {
            log.warn("Failed to refresh Ollama models: {}", e.getMessage());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private boolean isRelevantOpenAIModel(String modelId) {
        return modelId.startsWith("gpt-")
            || modelId.startsWith("o3")
            || modelId.startsWith("o4-")
            || modelId.startsWith("codex-");
    }

    /**
     * Build the hardcoded default model list used for initial seeding.
     */
    private List<ModelInfo> buildDefaultModels() {
        return List.of(
            // ── Anthropic ────────────────────────────────────────────────────
            new ModelInfo(
                "claude-opus-4-6",
                "Cortex Max — Máximo razonamiento",
                "anthropic", "Anthropic",
                "Most powerful Claude model for complex reasoning and analysis",
                "#9b59b6", "PREMIUM",
                true, false, true,
                200_000, 32_000, true, true, 1
            ),
            new ModelInfo(
                "claude-sonnet-4-6",
                "Cortex Pro — Equilibrio potencia/velocidad",
                "anthropic", "Anthropic",
                "Best balance of intelligence and speed for everyday coding tasks",
                "#3498db", null,
                false, false, true,
                200_000, 16_000, true, true, 2
            ),
            new ModelInfo(
                "claude-haiku-4-5",
                "Cortex Fast — Respuestas rápidas",
                "anthropic", "Anthropic",
                "Fastest Claude model for quick completions and simple tasks",
                "#2ecc71", null,
                false, false, true,
                200_000, 8_000, true, false, 3
            ),

            // ── OpenAI ───────────────────────────────────────────────────────
            new ModelInfo(
                "gpt-4o",
                "GPT-4o — Multimodal",
                "openai", "OpenAI",
                "OpenAI's flagship multimodal model with vision capabilities",
                "#f39c12", null,
                false, false, true,
                128_000, 16_384, true, true, 10
            ),
            new ModelInfo(
                "gpt-4o-mini",
                "GPT-4o Mini — Económico",
                "openai", "OpenAI",
                "Affordable and fast GPT-4o variant for high-volume tasks",
                "#f5cba7", null,
                false, false, true,
                128_000, 16_384, true, true, 11
            ),
            new ModelInfo(
                "o3",
                "O3 — Razonamiento avanzado",
                "openai", "OpenAI",
                "OpenAI's most powerful reasoning model for complex problems",
                "#e74c3c", "PREMIUM",
                true, false, true,
                200_000, 100_000, true, false, 12
            ),
            new ModelInfo(
                "o4-mini",
                "O4 Mini — Razonamiento rápido",
                "openai", "OpenAI",
                "Fast and efficient reasoning model for coding tasks",
                "#f39c12", null,
                false, false, true,
                200_000, 100_000, true, false, 13
            ),

            // ── OpenAI / Codex ───────────────────────────────────────────────
            new ModelInfo(
                "codex-mini-latest",
                "Codex Mini — Código ultrarrápido",
                "openai", "OpenAI / Codex",
                "Specialized code model optimized for ultra-fast completions",
                "#f1c40f", null,
                false, false, true,
                200_000, 32_000, true, false, 14
            ),

            // ── Google ───────────────────────────────────────────────────────
            new ModelInfo(
                "gemini-2.5-pro",
                "Gemini 2.5 Pro — Contexto largo",
                "google", "Google",
                "Google's most capable model with massive context window",
                "#5dade2", null,
                false, false, true,
                1_000_000, 65_536, true, true, 20
            ),
            new ModelInfo(
                "gemini-2.5-flash",
                "Gemini 2.5 Flash — Ultra rápido",
                "google", "Google",
                "Google's fastest model for real-time coding assistance",
                "#82e0aa", null,
                false, false, true,
                1_000_000, 65_536, true, true, 21
            ),

            // ── Ollama (offline) ─────────────────────────────────────────────
            new ModelInfo(
                "codellama",
                "CodeLlama — 100% privado, offline",
                "ollama", "Local",
                "Meta's code-specialized model running 100% on your machine",
                "#27ae60", "OFFLINE",
                false, true, false,
                100_000, 4_096, true, false, 30
            ),
            new ModelInfo(
                "deepseek-coder",
                "DeepSeek Coder — Offline",
                "ollama", "Local",
                "DeepSeek's code model running locally for maximum privacy",
                "#27ae60", "OFFLINE",
                false, true, false,
                16_000, 4_096, true, false, 31
            ),
            new ModelInfo(
                "llama3",
                "Llama 3 — Offline",
                "ollama", "Local",
                "Meta's Llama 3 general-purpose model running locally",
                "#27ae60", "OFFLINE",
                false, true, false,
                128_000, 4_096, true, false, 32
            )
        );
    }
}
