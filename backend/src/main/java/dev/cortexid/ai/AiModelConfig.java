package dev.cortexid.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for AI model providers.
 * Bound from application.yml under the 'cortex.ai' prefix.
 */
@Component
@ConfigurationProperties(prefix = "cortex.ai")
public class AiModelConfig {

    private String defaultModel = "claude-sonnet-4-6";
    private final Anthropic anthropic = new Anthropic();
    private final OpenAI openai = new OpenAI();
    private final Google google = new Google();
    private final Ollama ollama = new Ollama();

    // ── Getters / Setters ─────────────────────────────────────────────────────

    public String getDefaultModel() { return defaultModel; }
    public void setDefaultModel(String defaultModel) { this.defaultModel = defaultModel; }

    public Anthropic getAnthropic() { return anthropic; }
    public OpenAI getOpenai() { return openai; }
    public Google getGoogle() { return google; }
    public Ollama getOllama() { return ollama; }

    // ── Nested config classes ─────────────────────────────────────────────────

    public static class Anthropic {
        private String apiUrl = "https://api.anthropic.com/v1";
        private volatile String apiKey;

        public String getApiUrl() { return apiUrl; }
        public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    }

    public static class OpenAI {
        private String apiUrl = "https://api.openai.com/v1";
        private volatile String apiKey;

        public String getApiUrl() { return apiUrl; }
        public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    }

    public static class Google {
        private String apiUrl = "https://generativelanguage.googleapis.com/v1beta";
        private volatile String apiKey;

        public String getApiUrl() { return apiUrl; }
        public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    }

    public static class Ollama {
        private String apiUrl = "http://localhost:11434";

        public String getApiUrl() { return apiUrl; }
        public void setApiUrl(String apiUrl) { this.apiUrl = apiUrl; }
    }
}
