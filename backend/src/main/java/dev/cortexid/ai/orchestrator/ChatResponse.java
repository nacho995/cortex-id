package dev.cortexid.ai.orchestrator;

/**
 * Internal chat response record used by the orchestration layer.
 * Carries the full AI response before it is serialized into a WsMessage.
 *
 * @param content        Complete AI response text
 * @param model          Model that generated the response
 * @param conversationId Conversation thread identifier
 * @param agentId        ID of the agent that handled the request
 * @param tokensInput    Number of input tokens consumed
 * @param tokensOutput   Number of output tokens generated
 */
public record ChatResponse(
    String content,
    String model,
    String conversationId,
    String agentId,
    int tokensInput,
    int tokensOutput
) {}
