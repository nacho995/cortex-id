package dev.cortexid.ai.orchestrator;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Context attached to a chat message.
 * Gives the AI model awareness of the currently open file and its content.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChatContext(
    String filePath,
    String selectedCode,
    String language,
    String fileContent
) {}
