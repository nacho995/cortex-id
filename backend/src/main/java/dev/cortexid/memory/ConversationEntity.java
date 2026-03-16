package dev.cortexid.memory;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

/**
 * Entity for the conversation_history table.
 * Stores individual messages in a conversation thread.
 */
@Table("conversation_history")
public class ConversationEntity {

    @Id
    private Long id;

    @Column("conversation_id")
    private String conversationId;

    @Column("project_path")
    private String projectPath;

    @Column("role")
    private String role;

    @Column("content")
    private String content;

    @Column("model")
    private String model;

    @Column("tokens_input")
    private int tokensInput;

    @Column("tokens_output")
    private int tokensOutput;

    @Column("created_at")
    private LocalDateTime createdAt;

    public ConversationEntity() {}

    public ConversationEntity(
        String conversationId,
        String projectPath,
        String role,
        String content,
        String model,
        int tokensInput,
        int tokensOutput
    ) {
        this.conversationId = conversationId;
        this.projectPath = projectPath;
        this.role = role;
        this.content = content;
        this.model = model;
        this.tokensInput = tokensInput;
        this.tokensOutput = tokensOutput;
        this.createdAt = LocalDateTime.now();
    }

    // ── Getters / Setters ─────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }

    public String getProjectPath() { return projectPath; }
    public void setProjectPath(String projectPath) { this.projectPath = projectPath; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public int getTokensInput() { return tokensInput; }
    public void setTokensInput(int tokensInput) { this.tokensInput = tokensInput; }

    public int getTokensOutput() { return tokensOutput; }
    public void setTokensOutput(int tokensOutput) { this.tokensOutput = tokensOutput; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
