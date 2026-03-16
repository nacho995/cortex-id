package dev.cortexid.ai.models;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

/**
 * Entity representing a registered AI model in the model_registry table.
 * Tracks availability, capabilities and display metadata for the UI.
 */
@Table("model_registry")
public class ModelInfo {

    @Id
    private Long id;

    @Column("model_id")
    private String modelId;

    @Column("display_name")
    private String displayName;

    /** Provider identifier: "anthropic", "openai", "google", "ollama" */
    @Column("provider")
    private String provider;

    /** UI group label: "Anthropic", "OpenAI / Codex", "Google", "Local" */
    @Column("provider_group")
    private String providerGroup;

    @Column("description")
    private String description;

    /** Hex color for the UI badge (e.g. "#9b59b6") */
    @Column("badge_color")
    private String badgeColor;

    /** Badge label shown in UI: "PREMIUM", "OFFLINE", "NEW", or null */
    @Column("badge_label")
    private String badgeLabel;

    @Column("is_premium")
    private boolean isPremium;

    @Column("is_offline")
    private boolean isOffline;

    @Column("is_available")
    private boolean isAvailable;

    @Column("context_window")
    private int contextWindow;

    @Column("max_output_tokens")
    private int maxOutputTokens;

    @Column("supports_streaming")
    private boolean supportsStreaming;

    @Column("supports_vision")
    private boolean supportsVision;

    @Column("first_seen_at")
    private LocalDateTime firstSeenAt;

    @Column("last_verified_at")
    private LocalDateTime lastVerifiedAt;

    @Column("sort_order")
    private int sortOrder;

    // ── Constructors ──────────────────────────────────────────────────────────

    public ModelInfo() {}

    public ModelInfo(
        String modelId,
        String displayName,
        String provider,
        String providerGroup,
        String description,
        String badgeColor,
        String badgeLabel,
        boolean isPremium,
        boolean isOffline,
        boolean isAvailable,
        int contextWindow,
        int maxOutputTokens,
        boolean supportsStreaming,
        boolean supportsVision,
        int sortOrder
    ) {
        this.modelId = modelId;
        this.displayName = displayName;
        this.provider = provider;
        this.providerGroup = providerGroup;
        this.description = description;
        this.badgeColor = badgeColor;
        this.badgeLabel = badgeLabel;
        this.isPremium = isPremium;
        this.isOffline = isOffline;
        this.isAvailable = isAvailable;
        this.contextWindow = contextWindow;
        this.maxOutputTokens = maxOutputTokens;
        this.supportsStreaming = supportsStreaming;
        this.supportsVision = supportsVision;
        this.sortOrder = sortOrder;
        this.firstSeenAt = LocalDateTime.now();
    }

    // ── Getters / Setters ─────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getModelId() { return modelId; }
    public void setModelId(String modelId) { this.modelId = modelId; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getProviderGroup() { return providerGroup; }
    public void setProviderGroup(String providerGroup) { this.providerGroup = providerGroup; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getBadgeColor() { return badgeColor; }
    public void setBadgeColor(String badgeColor) { this.badgeColor = badgeColor; }

    public String getBadgeLabel() { return badgeLabel; }
    public void setBadgeLabel(String badgeLabel) { this.badgeLabel = badgeLabel; }

    public boolean isPremium() { return isPremium; }
    public void setPremium(boolean premium) { isPremium = premium; }

    public boolean isOffline() { return isOffline; }
    public void setOffline(boolean offline) { isOffline = offline; }

    public boolean isAvailable() { return isAvailable; }
    public void setAvailable(boolean available) { isAvailable = available; }

    public int getContextWindow() { return contextWindow; }
    public void setContextWindow(int contextWindow) { this.contextWindow = contextWindow; }

    public int getMaxOutputTokens() { return maxOutputTokens; }
    public void setMaxOutputTokens(int maxOutputTokens) { this.maxOutputTokens = maxOutputTokens; }

    public boolean isSupportsStreaming() { return supportsStreaming; }
    public void setSupportsStreaming(boolean supportsStreaming) { this.supportsStreaming = supportsStreaming; }

    public boolean isSupportsVision() { return supportsVision; }
    public void setSupportsVision(boolean supportsVision) { this.supportsVision = supportsVision; }

    public LocalDateTime getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(LocalDateTime firstSeenAt) { this.firstSeenAt = firstSeenAt; }

    public LocalDateTime getLastVerifiedAt() { return lastVerifiedAt; }
    public void setLastVerifiedAt(LocalDateTime lastVerifiedAt) { this.lastVerifiedAt = lastVerifiedAt; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
