package dev.cortexid.git;

import java.util.List;

/**
 * Immutable snapshot of a Git repository's working tree status.
 *
 * @param modified   Files with modifications (tracked, changed)
 * @param added      Files staged for addition
 * @param deleted    Files staged for deletion
 * @param untracked  Files not tracked by Git
 * @param branch     Current branch name
 */
public record GitStatus(
    List<String> modified,
    List<String> added,
    List<String> deleted,
    List<String> untracked,
    String branch
) {}
