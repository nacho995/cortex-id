package dev.cortexid.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for WsMessage envelope serialization.
 * Verifies the JSON contract matches the TypeScript shared-types.
 */
class WsMessageTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void create_shouldGenerateUuidAndTimestamp() {
        WsMessage<Map<String, Object>> msg = WsMessage.create(
            WsMessageTypes.HEALTH_PONG, Map.of()
        );

        assertThat(msg.type()).isEqualTo("health:pong");
        assertThat(msg.id()).isNotBlank();
        assertThat(msg.timestamp()).isGreaterThan(0);
        assertThat(msg.payload()).isEmpty();
    }

    @Test
    void of_shouldUseProvidedId() {
        WsMessage<Map<String, Object>> msg = WsMessage.of(
            WsMessageTypes.CHAT_STREAM_START, "test-id-123", Map.of("conversationId", "conv-1")
        );

        assertThat(msg.id()).isEqualTo("test-id-123");
        assertThat(msg.type()).isEqualTo("chat:stream-start");
    }

    @Test
    void serialization_shouldMatchTypeScriptContract() throws Exception {
        WsMessage<Map<String, Object>> msg = WsMessage.of(
            WsMessageTypes.HEALTH_PING, "ping-id", Map.of()
        );

        String json = objectMapper.writeValueAsString(msg);

        assertThat(json).contains("\"type\":\"health:ping\"");
        assertThat(json).contains("\"id\":\"ping-id\"");
        assertThat(json).contains("\"timestamp\":");
        assertThat(json).contains("\"payload\":");
    }

    @Test
    void deserialization_shouldParseTypeField() throws Exception {
        String json = """
            {
              "type": "chat:message",
              "id": "abc-123",
              "timestamp": 1700000000000,
              "payload": {}
            }
            """;

        WsMessage<?> msg = objectMapper.readValue(json, WsMessage.class);

        assertThat(msg.type()).isEqualTo("chat:message");
        assertThat(msg.id()).isEqualTo("abc-123");
        assertThat(msg.timestamp()).isEqualTo(1700000000000L);
    }

    @Test
    void messageTypes_shouldMatchSharedTypesContracts() {
        // Verify all constants match the TypeScript WS_EVENTS values
        assertThat(WsMessageTypes.CHAT_MESSAGE).isEqualTo("chat:message");
        assertThat(WsMessageTypes.CHAT_RESPONSE).isEqualTo("chat:response");
        assertThat(WsMessageTypes.CHAT_STREAM_START).isEqualTo("chat:stream-start");
        assertThat(WsMessageTypes.CHAT_STREAM_CHUNK).isEqualTo("chat:stream-chunk");
        assertThat(WsMessageTypes.CHAT_STREAM_END).isEqualTo("chat:stream-end");
        assertThat(WsMessageTypes.CHAT_ERROR).isEqualTo("chat:error");
        assertThat(WsMessageTypes.AGENT_STATUS).isEqualTo("agent:status");
        assertThat(WsMessageTypes.AGENT_PROGRESS).isEqualTo("agent:progress");
        assertThat(WsMessageTypes.FILE_INDEX_STATUS).isEqualTo("file:index-status");
        assertThat(WsMessageTypes.FILE_INDEX_COMPLETE).isEqualTo("file:index-complete");
        assertThat(WsMessageTypes.HEALTH_PING).isEqualTo("health:ping");
        assertThat(WsMessageTypes.HEALTH_PONG).isEqualTo("health:pong");
    }
}
