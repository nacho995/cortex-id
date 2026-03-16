package dev.cortexid.memory;

import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data JDBC repository for the conversation_history table.
 */
@Repository
public interface ConversationRepository extends CrudRepository<ConversationEntity, Long> {

    @Query("SELECT * FROM conversation_history WHERE conversation_id = :conversationId ORDER BY created_at ASC")
    List<ConversationEntity> findByConversationId(String conversationId);

    @Query("SELECT * FROM conversation_history WHERE conversation_id = :conversationId ORDER BY created_at DESC LIMIT :limit")
    List<ConversationEntity> findRecentByConversationId(String conversationId, int limit);

    @Query("SELECT * FROM conversation_history WHERE project_path = :projectPath ORDER BY created_at DESC LIMIT :limit")
    List<ConversationEntity> findRecentByProjectPath(String projectPath, int limit);

    @Query("SELECT COUNT(*) FROM conversation_history WHERE conversation_id = :conversationId")
    int countByConversationId(String conversationId);
}
