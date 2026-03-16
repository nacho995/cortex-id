package dev.cortexid.ai.orchestrator;

import dev.cortexid.ai.AnthropicClient;
import dev.cortexid.ai.AnthropicClient.ConversationMessage;
import dev.cortexid.ai.AiModelConfig;
import dev.cortexid.ai.GoogleClient;
import dev.cortexid.ai.OllamaClient;
import dev.cortexid.ai.OpenAIClient;
import dev.cortexid.memory.ConversationEntity;
import dev.cortexid.memory.ConversationRepository;
import dev.cortexid.websocket.SessionRegistry;
import dev.cortexid.websocket.WsMessage;
import dev.cortexid.websocket.WsMessageTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * AI Orchestration Service.
 * Routes chat messages to the appropriate AI provider based on model prefix:
 * <ul>
 *   <li>claude-*         → Anthropic</li>
 *   <li>gpt-*, o3*, o4-*, codex-* → OpenAI</li>
 *   <li>gemini-*         → Google</li>
 *   <li>everything else  → Ollama (local)</li>
 * </ul>
 * Manages conversation context and streams responses back via WebSocket.
 */
@Service
public class OrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(OrchestrationService.class);
    private static final int MAX_CONTEXT_MESSAGES = 20;
    private static final String AGENT_ID = "cortex-assistant";

    private final AnthropicClient anthropicClient;
    private final OpenAIClient openAIClient;
    private final GoogleClient googleClient;
    private final OllamaClient ollamaClient;
    private final ConversationRepository conversationRepository;
    private final SessionRegistry sessionRegistry;
    private final AiModelConfig aiModelConfig;

    public OrchestrationService(
        AnthropicClient anthropicClient,
        OpenAIClient openAIClient,
        GoogleClient googleClient,
        OllamaClient ollamaClient,
        ConversationRepository conversationRepository,
        SessionRegistry sessionRegistry,
        AiModelConfig aiModelConfig
    ) {
        this.anthropicClient = anthropicClient;
        this.openAIClient = openAIClient;
        this.googleClient = googleClient;
        this.ollamaClient = ollamaClient;
        this.conversationRepository = conversationRepository;
        this.sessionRegistry = sessionRegistry;
        this.aiModelConfig = aiModelConfig;
    }

    /**
     * Handle an incoming chat message from the WebSocket.
     * Streams the AI response back to the client.
     */
    public void handleChatMessage(WebSocketSession session, WsMessage<ChatMessagePayload> message) {
        ChatMessagePayload payload = message.payload();
        String conversationId = resolveConversationId(payload.conversationId());
        String model = resolveModel(payload.model());

        log.info("Handling chat message: conversationId={}, model={}", conversationId, model);

        // Notify agent is thinking
        sendAgentStatus(session, "thinking", "Processing your request...", null);

        // Build dynamic system prompt with project context
        String systemPrompt = buildSystemPrompt(payload);

        // Build conversation context (strips mode prefixes from user message)
        List<ConversationMessage> messages = buildConversationContext(
            conversationId, payload.content(), payload.context()
        );

        // Save user message to history (original content, before stripping)
        saveMessage(conversationId, null, "user", payload.content(), model, 0, 0);

        // Send stream start
        sessionRegistry.sendTo(session, WsMessage.create(
            WsMessageTypes.CHAT_STREAM_START,
            Map.of("conversationId", conversationId)
        ));

        // Notify agent is working
        sendAgentStatus(session, "working", "Generating response...", null);

        // Accumulate full response for persistence
        StringBuilder fullResponse = new StringBuilder();

        // Route to the appropriate provider asynchronously
        CompletableFuture.runAsync(() -> routeToProvider(
            session, conversationId, model, payload.apiKey(), messages, fullResponse, systemPrompt
        ));
    }

    // ── Provider routing ──────────────────────────────────────────────────────

    /**
     * Route the request to the correct AI provider based on model prefix.
     * BUG-2 FIX: Ollama is optional — if unavailable, send a friendly error.
     *
     * @param systemPrompt Dynamic system prompt built from project context
     */
    private void routeToProvider(
        WebSocketSession session,
        String conversationId,
        String model,
        String requestApiKey,
        List<ConversationMessage> messages,
        StringBuilder fullResponse,
        String systemPrompt
    ) {
        if (isAnthropicModel(model)) {
            String key = resolveKey(requestApiKey, aiModelConfig.getAnthropic().getApiKey());
            if (key == null || key.isBlank()) {
                onStreamError(session, conversationId,
                    "No Anthropic API key configured. Please set your API key in Settings → AI Providers.");
                return;
            }
            log.info("Routing to Anthropic, model={}", model);
            anthropicClient.streamChat(
                messages, model, key, systemPrompt,
                chunk -> { fullResponse.append(chunk); sendStreamChunk(session, chunk, conversationId, false); },
                () -> onStreamComplete(session, conversationId, model, fullResponse.toString()),
                error -> onStreamError(session, conversationId, error)
            );

        } else if (isOpenAIModel(model)) {
            String key = resolveKey(requestApiKey, aiModelConfig.getOpenai().getApiKey());
            if (key == null || key.isBlank()) {
                onStreamError(session, conversationId,
                    "No OpenAI API key configured. Please set your API key in Settings → AI Providers.");
                return;
            }
            log.info("Routing to OpenAI, model={}", model);
            openAIClient.streamChat(
                messages, model, key, systemPrompt,
                chunk -> { fullResponse.append(chunk); sendStreamChunk(session, chunk, conversationId, false); },
                () -> onStreamComplete(session, conversationId, model, fullResponse.toString()),
                error -> onStreamError(session, conversationId, error)
            );

        } else if (isGoogleModel(model)) {
            String key = resolveKey(requestApiKey, aiModelConfig.getGoogle().getApiKey());
            if (key == null || key.isBlank()) {
                onStreamError(session, conversationId,
                    "No Google API key configured. Please set your API key in Settings → AI Providers.");
                return;
            }
            log.info("Routing to Google Gemini, model={}", model);
            googleClient.streamChat(
                messages, model, key, systemPrompt,
                chunk -> { fullResponse.append(chunk); sendStreamChunk(session, chunk, conversationId, false); },
                () -> onStreamComplete(session, conversationId, model, fullResponse.toString()),
                error -> onStreamError(session, conversationId, error)
            );

        } else {
            // BUG-2 FIX: Ollama is optional — check availability before routing
            log.info("Routing to Ollama (local), model={}", model);
            boolean ollamaAvailable;
            try {
                ollamaAvailable = ollamaClient.isAvailable();
            } catch (Exception e) {
                log.warn("Error checking Ollama availability: {}", e.getMessage());
                ollamaAvailable = false;
            }

            if (!ollamaAvailable) {
                onStreamError(session, conversationId,
                    "No AI provider available. Please configure an API key in Settings → AI Providers, "
                    + "or install Ollama for offline mode.");
                return;
            }

            ollamaClient.streamChat(
                messages, model,
                chunk -> { fullResponse.append(chunk); sendStreamChunk(session, chunk, conversationId, false); },
                () -> onStreamComplete(session, conversationId, model, fullResponse.toString()),
                error -> onStreamError(session, conversationId, error)
            );
        }
    }

    // ── Dynamic system prompt ─────────────────────────────────────────────────

    /**
     * Build a context-aware system prompt from the incoming payload.
     * Extracts mode flags ([RUBBER_DUCK_MODE], [EXPLAIN_LEVEL:*]) and project
     * context so the AI knows exactly what it has access to.
     */
    private String buildSystemPrompt(ChatMessagePayload payload) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("""
            You are Cortex-ID, an AI coding assistant integrated directly into the developer's IDE.
            You have FULL ACCESS to the developer's project. You CAN see their files, code, and project structure.

            IMPORTANT: You are NOT a generic chatbot. You are embedded in the IDE and you CAN:
            - See the currently open file and its content
            - Know the project structure and file paths
            - Read the code the user is working on
            - Suggest specific changes with exact line references

            Be concise, precise, and helpful. Use proper markdown code blocks with language identifiers.
            When suggesting changes, be specific about file names and line numbers.
            """);

        // Add project context if available
        ChatContext ctx = payload.context();
        if (ctx != null) {
            if (ctx.filePath() != null && !ctx.filePath().isBlank()) {
                prompt.append("\n\nCurrently open file: ").append(ctx.filePath());
            }
            if (ctx.language() != null && !ctx.language().isBlank()) {
                prompt.append("\nLanguage: ").append(ctx.language());
            }
        }

        // Add mode-specific instructions based on flags in the message content
        String content = payload.content() != null ? payload.content() : "";

        if (content.contains("[RUBBER_DUCK_MODE]")) {
            prompt.append("""

                RUBBER DUCK MODE ACTIVE: Do NOT give the solution directly.
                Instead, ask Socratic questions that guide the developer to find the answer themselves.
                Start with "What have you tried so far?" then guide with hints.
                Only reveal the solution after 5+ messages if the user is still stuck.
                """);
        }

        if (content.contains("[EXPLAIN_LEVEL:junior]")) {
            prompt.append("""

                EXPLAIN LEVEL: JUNIOR. Explain as if talking to a beginner developer.
                Use simple language, analogies, and step-by-step explanations.
                Avoid jargon. If you must use a technical term, define it.
                """);
        } else if (content.contains("[EXPLAIN_LEVEL:senior]")) {
            prompt.append("""

                EXPLAIN LEVEL: SENIOR. Explain at an expert level.
                Use precise technical terminology. Discuss trade-offs, performance implications,
                design patterns, and edge cases. Be terse — no hand-holding.
                """);
        }

        // Add project path if present in the enriched message
        try {
            String projectPath = extractProjectPath(content);
            if (projectPath != null) {
                prompt.append("\n\nProject path: ").append(projectPath);
            }
        } catch (Exception e) {
            // Ignore — don't break the prompt if extraction fails
        }

        return prompt.toString();
    }

    /**
     * Strip mode-prefix markers from the user message content.
     * These are moved to the system prompt; the user message should contain
     * only the actual question and file content blocks.
     * NOTE: [Project:], [Current file:], [Language:] tags are removed,
     * but --- CURRENT FILE --- and --- FILE TO EDIT --- blocks are preserved.
     */
    private String cleanMessageContent(String content) {
        if (content == null) return "";
        return content
            .replaceAll("\\[RUBBER_DUCK_MODE]\\s*", "")
            .replaceAll("\\[EXPLAIN_LEVEL:\\w+]\\s*", "")
            .replaceAll("\\n*\\[Project: [^]]+]", "")
            .replaceAll("\\n*\\[Current file: [^]]+]", "")
            .replaceAll("\\n*\\[Language: [^]]+]", "")
            .trim();
    }

    /**
     * Extract the project path from a [Project: /path/to/project] tag in the content.
     */
    private String extractProjectPath(String content) {
        if (content == null) return null;
        int idx = content.indexOf("[Project: ");
        if (idx < 0) return null;
        int end = content.indexOf("]", idx);
        if (end < 0) return null;
        return content.substring(idx + 10, end).trim();
    }

    // ── Model classification helpers ──────────────────────────────────────────

    private boolean isAnthropicModel(String model) {
        return model != null && model.startsWith("claude-");
    }

    private boolean isOpenAIModel(String model) {
        if (model == null) return false;
        return model.startsWith("gpt-")
            || model.startsWith("o3")
            || model.startsWith("o4-")
            || model.startsWith("codex-");
    }

    private boolean isGoogleModel(String model) {
        return model != null && model.startsWith("gemini-");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String resolveConversationId(String conversationId) {
        return (conversationId != null && !conversationId.isBlank())
            ? conversationId
            : UUID.randomUUID().toString();
    }

    private String resolveModel(String requestedModel) {
        return (requestedModel != null && !requestedModel.isBlank())
            ? requestedModel
            : aiModelConfig.getDefaultModel();
    }

    /**
     * Resolve the API key: prefer the per-request key, fall back to config.
     */
    private String resolveKey(String requestKey, String configKey) {
        if (requestKey != null && !requestKey.isBlank()) return requestKey;
        return configKey;
    }

    private List<ConversationMessage> buildConversationContext(
        String conversationId,
        String userContent,
        ChatContext context
    ) {
        List<ConversationMessage> messages = new ArrayList<>();

        // Load recent conversation history
        List<ConversationEntity> history = conversationRepository
            .findRecentByConversationId(conversationId, MAX_CONTEXT_MESSAGES);

        // History is returned DESC, reverse to get chronological order
        for (int i = history.size() - 1; i >= 0; i--) {
            ConversationEntity entry = history.get(i);
            messages.add(new ConversationMessage(entry.getRole(), entry.getContent()));
        }

        // Strip mode-prefix markers (they are now in the system prompt)
        // but keep --- CURRENT FILE --- and --- FILE TO EDIT --- blocks intact
        String cleanedContent = cleanMessageContent(userContent);

        // Build the current user message with optional context
        String enrichedContent = enrichWithContext(cleanedContent, context);
        messages.add(new ConversationMessage("user", enrichedContent));

        return messages;
    }

    private String enrichWithContext(String content, ChatContext context) {
        if (context == null) return content;

        StringBuilder enriched = new StringBuilder(content);

        if (context.filePath() != null && !context.filePath().isBlank()) {
            enriched.append("\n\n**Current file:** `").append(context.filePath()).append("`");
        }

        if (context.selectedCode() != null && !context.selectedCode().isBlank()) {
            String lang = context.language() != null ? context.language() : "";
            enriched.append("\n\n**Selected code:**\n```").append(lang).append("\n")
                .append(context.selectedCode()).append("\n```");
        }

        return enriched.toString();
    }

    private void sendStreamChunk(WebSocketSession session, String chunk, String conversationId, boolean done) {
        Map<String, Object> chunkPayload = Map.of(
            "content", chunk,
            "conversationId", conversationId,
            "agentId", AGENT_ID,
            "done", done
        );
        sessionRegistry.sendTo(session, WsMessage.create(WsMessageTypes.CHAT_STREAM_CHUNK, chunkPayload));
    }

    private void onStreamComplete(WebSocketSession session, String conversationId, String model, String fullResponse) {
        // Send final chunk with done=true
        sendStreamChunk(session, "", conversationId, true);

        // Send stream end
        sessionRegistry.sendTo(session, WsMessage.create(
            WsMessageTypes.CHAT_STREAM_END,
            Map.of("conversationId", conversationId)
        ));

        // Save assistant response to history
        saveMessage(conversationId, null, "assistant", fullResponse, model, 0, 0);

        // Notify agent is done
        sendAgentStatus(session, "done", "Response complete", null);

        log.info("Stream complete: conversationId={}, responseLength={}", conversationId, fullResponse.length());
    }

    private void onStreamError(WebSocketSession session, String conversationId, String error) {
        log.error("Stream error for conversationId={}: {}", conversationId, error);

        // Send stream end to close the stream
        sessionRegistry.sendTo(session, WsMessage.create(
            WsMessageTypes.CHAT_STREAM_END,
            Map.of("conversationId", conversationId)
        ));

        // Send error message
        sessionRegistry.sendTo(session, WsMessage.create(
            WsMessageTypes.CHAT_ERROR,
            Map.of(
                "code", "AI_ERROR",
                "message", error,
                "conversationId", conversationId
            )
        ));

        // Notify agent error
        sendAgentStatus(session, "error", error, null);
    }

    private void sendAgentStatus(WebSocketSession session, String status, String task, Integer progress) {
        Map<String, Object> agentPayload = progress != null
            ? Map.of("agentId", AGENT_ID, "name", "Cortex Assistant", "status", status, "task", task, "progress", progress)
            : Map.of("agentId", AGENT_ID, "name", "Cortex Assistant", "status", status, "task", task);

        sessionRegistry.sendTo(session, WsMessage.create(WsMessageTypes.AGENT_STATUS, agentPayload));
    }

    private void saveMessage(
        String conversationId,
        String projectPath,
        String role,
        String content,
        String model,
        int tokensInput,
        int tokensOutput
    ) {
        try {
            ConversationEntity entity = new ConversationEntity(
                conversationId, projectPath, role, content, model, tokensInput, tokensOutput
            );
            conversationRepository.save(entity);
        } catch (Exception e) {
            log.warn("Failed to save conversation message: {}", e.getMessage());
        }
    }
}
