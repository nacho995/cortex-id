package dev.cortexid.ai.orchestrator;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Context attached to a chat message.
 * Gives the AI model awareness of the currently open file or selected code.
 * Matches the TypeScript ChatContext interface in shared-types.
 *
 * @param filePath     Absolute path of the file currently open in the editor
 * @param selectedCode Code snippet selected by the user in the editor
 * @param language     Language identifier (e.g. 'typescript', 'java')
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ChatContext(
    String filePath,
    String selectedCode,
    String language
) {}
