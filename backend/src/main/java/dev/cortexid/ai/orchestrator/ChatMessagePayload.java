package dev.cortexid.ai.orchestrator;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Payload for CHAT_MESSAGE — received from Angular.
 * Matches the TypeScript ChatMessagePayload interface in shared-types.
 *
 * @param content        User's message text
 * @param context        Optional editor context (file, selected code, language)
 * @param model          Model override (e.g. 'claude-3-5-sonnet-20241022')
 * @param conversationId Conversation thread identifier (null = new conversation)
 * @param apiKey         Optional API key override from the frontend
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChatMessagePayload(
    String content,
    ChatContext context,
    String model,
    String conversationId,
    String apiKey
) {}
