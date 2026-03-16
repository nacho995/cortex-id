package dev.cortexid.git;

import java.time.LocalDateTime;

/**
 * Immutable record representing a Git commit.
 *
 * @param hash    Full commit hash
 * @param message Commit message (first line)
 * @param author  Author name and email
 * @param date    Commit timestamp
 */
public record CommitInfo(
    String hash,
    String message,
    String author,
    LocalDateTime date
) {}
