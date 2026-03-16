package dev.cortexid.indexer;

import java.time.LocalDateTime;

/**
 * Immutable record representing indexed file metadata.
 *
 * @param filePath     Absolute path to the file
 * @param fileName     File name with extension
 * @param language     Detected programming language
 * @param size         File size in bytes
 * @param lastModified Last modification timestamp
 */
public record FileInfo(
    String filePath,
    String fileName,
    String language,
    long size,
    LocalDateTime lastModified
) {}
