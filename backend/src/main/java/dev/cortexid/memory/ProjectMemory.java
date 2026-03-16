package dev.cortexid.memory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for project-specific memory.
 * Stores and retrieves key-value pairs scoped to a project path.
 * Used by the AI orchestrator to remember project-specific conventions and context.
 */
@Service
public class ProjectMemory {

    private static final Logger log = LoggerFactory.getLogger(ProjectMemory.class);

    private final MemoryRepository memoryRepository;

    public ProjectMemory(MemoryRepository memoryRepository) {
        this.memoryRepository = memoryRepository;
    }

    /**
     * Store or update a memory entry for a project.
     */
    public void remember(String projectPath, String key, String value, String category) {
        Optional<ProjectMemoryEntity> existing = memoryRepository.findByProjectPathAndKey(projectPath, key);

        if (existing.isPresent()) {
            ProjectMemoryEntity entity = existing.get();
            entity.setValue(value);
            entity.setUpdatedAt(LocalDateTime.now());
            memoryRepository.save(entity);
            log.debug("Updated memory: project={}, key={}", projectPath, key);
        } else {
            ProjectMemoryEntity entity = new ProjectMemoryEntity(projectPath, key, value, category);
            memoryRepository.save(entity);
            log.debug("Stored memory: project={}, key={}, category={}", projectPath, key, category);
        }
    }

    /**
     * Store a memory entry in the 'general' category.
     */
    public void remember(String projectPath, String key, String value) {
        remember(projectPath, key, value, "general");
    }

    /**
     * Retrieve a memory entry by key.
     */
    public Optional<String> recall(String projectPath, String key) {
        return memoryRepository.findByProjectPathAndKey(projectPath, key)
            .map(ProjectMemoryEntity::getValue);
    }

    /**
     * Retrieve all memory entries for a project as a map.
     */
    public Map<String, String> recallAll(String projectPath) {
        return memoryRepository.findByProjectPath(projectPath).stream()
            .collect(Collectors.toMap(
                ProjectMemoryEntity::getKey,
                ProjectMemoryEntity::getValue
            ));
    }

    /**
     * Retrieve all memory entries for a project in a specific category.
     */
    public Map<String, String> recallByCategory(String projectPath, String category) {
        return memoryRepository.findByProjectPathAndCategory(projectPath, category).stream()
            .collect(Collectors.toMap(
                ProjectMemoryEntity::getKey,
                ProjectMemoryEntity::getValue
            ));
    }

    /**
     * Forget a specific memory entry.
     */
    public void forget(String projectPath, String key) {
        memoryRepository.deleteByProjectPathAndKey(projectPath, key);
        log.debug("Forgot memory: project={}, key={}", projectPath, key);
    }

    /**
     * Forget all memory for a project.
     */
    public void forgetAll(String projectPath) {
        memoryRepository.deleteByProjectPath(projectPath);
        log.info("Cleared all memory for project: {}", projectPath);
    }

    /**
     * Build a context string from project memory for inclusion in AI prompts.
     */
    public String buildContextString(String projectPath) {
        Map<String, String> conventions = recallByCategory(projectPath, "conventions");
        Map<String, String> preferences = recallByCategory(projectPath, "preferences");

        if (conventions.isEmpty() && preferences.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder("\n\n## Project Context\n");

        if (!conventions.isEmpty()) {
            sb.append("### Conventions\n");
            conventions.forEach((k, v) -> sb.append("- ").append(k).append(": ").append(v).append("\n"));
        }

        if (!preferences.isEmpty()) {
            sb.append("### Preferences\n");
            preferences.forEach((k, v) -> sb.append("- ").append(k).append(": ").append(v).append("\n"));
        }

        return sb.toString();
    }

    /**
     * Get all memory entries as a list of entities.
     */
    public List<ProjectMemoryEntity> listAll(String projectPath) {
        return memoryRepository.findByProjectPath(projectPath);
    }
}
