package dev.cortexid.websocket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Generic WebSocket message envelope.
 * Matches the TypeScript WsMessage<T> interface in shared-types.
 *
 * @param type      Discriminator — identifies the payload shape (e.g. "chat:message")
 * @param id        Unique message identifier (UUID v4)
 * @param timestamp Unix timestamp in milliseconds
 * @param payload   Message-specific payload
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record WsMessage<T>(
    String type,
    String id,
    long timestamp,
    T payload
) {
    /**
     * Factory method for outbound messages with current timestamp.
     */
    public static <T> WsMessage<T> of(String type, String id, T payload) {
        return new WsMessage<>(type, id, System.currentTimeMillis(), payload);
    }

    /**
     * Factory method for outbound messages with a new random ID.
     */
    public static <T> WsMessage<T> create(String type, T payload) {
        return new WsMessage<>(type, java.util.UUID.randomUUID().toString(),
            System.currentTimeMillis(), payload);
    }
}
