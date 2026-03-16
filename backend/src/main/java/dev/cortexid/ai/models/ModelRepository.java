package dev.cortexid.ai.models;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JDBC repository for the model_registry table.
 */
@Repository
public interface ModelRepository extends CrudRepository<ModelInfo, Long> {

    @Query("SELECT * FROM model_registry WHERE is_available = 1 ORDER BY sort_order ASC")
    List<ModelInfo> findByIsAvailableTrue();

    @Query("SELECT * FROM model_registry WHERE provider = :provider ORDER BY sort_order ASC")
    List<ModelInfo> findByProvider(String provider);

    @Query("SELECT * FROM model_registry WHERE model_id = :modelId LIMIT 1")
    Optional<ModelInfo> findByModelId(String modelId);

    @Query("SELECT * FROM model_registry ORDER BY sort_order ASC")
    List<ModelInfo> findAllOrderBySortOrder();
}
