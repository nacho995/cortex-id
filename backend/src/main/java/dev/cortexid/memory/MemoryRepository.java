package dev.cortexid.memory;

import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JDBC repository for the project_memory table.
 */
@Repository
public interface MemoryRepository extends CrudRepository<ProjectMemoryEntity, Long> {

    @Query("SELECT * FROM project_memory WHERE project_path = :projectPath ORDER BY key")
    List<ProjectMemoryEntity> findByProjectPath(String projectPath);

    @Query("SELECT * FROM project_memory WHERE project_path = :projectPath AND category = :category ORDER BY key")
    List<ProjectMemoryEntity> findByProjectPathAndCategory(String projectPath, String category);

    @Query("SELECT * FROM project_memory WHERE project_path = :projectPath AND key = :key LIMIT 1")
    Optional<ProjectMemoryEntity> findByProjectPathAndKey(String projectPath, String key);

    @Modifying
    @Query("DELETE FROM project_memory WHERE project_path = :projectPath AND key = :key")
    void deleteByProjectPathAndKey(String projectPath, String key);

    @Modifying
    @Query("DELETE FROM project_memory WHERE project_path = :projectPath")
    void deleteByProjectPath(String projectPath);
}
