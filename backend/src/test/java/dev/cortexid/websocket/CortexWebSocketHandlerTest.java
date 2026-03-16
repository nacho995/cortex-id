package dev.cortexid.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.cortexid.ai.AiModelConfig;
import dev.cortexid.ai.AnthropicClient;
import dev.cortexid.ai.GoogleClient;
import dev.cortexid.ai.OpenAIClient;
import dev.cortexid.ai.models.ModelRegistryService;
import dev.cortexid.ai.orchestrator.OrchestrationService;
import dev.cortexid.indexer.FileIndexer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for CortexWebSocketHandler.
 * Verifies connection lifecycle, message routing, and error handling.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("CortexWebSocketHandler")
class CortexWebSocketHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock private SessionRegistry sessionRegistry;
    @Mock private OrchestrationService orchestrationService;
    @Mock private FileIndexer fileIndexer;
    @Mock private ModelRegistryService modelRegistryService;
    @Mock private AiModelConfig aiModelConfig;
    @Mock private AnthropicClient anthropicClient;
    @Mock private OpenAIClient openAIClient;
    @Mock private GoogleClient googleClient;
    @Mock private WebSocketSession session;

    private CortexWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new CortexWebSocketHandler(
            objectMapper, sessionRegistry, orchestrationService, fileIndexer,
            modelRegistryService, aiModelConfig, anthropicClient, openAIClient, googleClient
        );
        when(session.getId()).thenReturn("test-session-id");
        when(session.isOpen()).thenReturn(true);
        when(modelRegistryService.getAllModels()).thenReturn(List.of());
    }

    @Nested
    @DisplayName("connection lifecycle")
    class ConnectionLifecycleTests {

        @Test
        @DisplayName("registers session on connection established")
        void afterConnectionEstablished_registersSession() throws Exception {
            // Act
            handler.afterConnectionEstablished(session);

            // Assert
            verify(sessionRegistry).register(session);
        }

        @Test
        @DisplayName("sends HEALTH_PONG immediately on connection established")
        void afterConnectionEstablished_sendsPongToConfirmConnection() throws Exception {
            // Arrange
            when(sessionRegistry.count()).thenReturn(1);

            // Act
            handler.afterConnectionEstablished(session);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry).sendTo(eq(session), captor.capture());
            assertThat(captor.getValue().type()).isEqualTo(WsMessageTypes.HEALTH_PONG);
        }

        @Test
        @DisplayName("unregisters session on connection closed")
        void afterConnectionClosed_unregistersSession() throws Exception {
            // Act
            handler.afterConnectionClosed(session, CloseStatus.NORMAL);

            // Assert
            verify(sessionRegistry).unregister(session);
        }

        @Test
        @DisplayName("unregisters session on transport error")
        void handleTransportError_unregistersSession() throws Exception {
            // Act
            handler.handleTransportError(session, new RuntimeException("Transport error"));

            // Assert
            verify(sessionRegistry).unregister(session);
        }
    }

    @Nested
    @DisplayName("ping/pong")
    class PingPongTests {

        @Test
        @DisplayName("responds with HEALTH_PONG when HEALTH_PING received")
        void handleTextMessage_withPing_sendsPong() throws Exception {
            // Arrange
            String pingJson = """
                {
                  "type": "health:ping",
                  "id": "ping-123",
                  "timestamp": 1700000000000,
                  "payload": {}
                }
                """;

            // Act
            handler.handleTextMessage(session, new TextMessage(pingJson));

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry).sendTo(eq(session), captor.capture());
            assertThat(captor.getValue().type()).isEqualTo(WsMessageTypes.HEALTH_PONG);
        }

        @Test
        @DisplayName("pong preserves the ping message ID")
        void handleTextMessage_withPing_pongPreservesPingId() throws Exception {
            // Arrange
            String pingJson = """
                {
                  "type": "health:ping",
                  "id": "my-ping-id-456",
                  "timestamp": 1700000000000,
                  "payload": {}
                }
                """;

            // Act
            handler.handleTextMessage(session, new TextMessage(pingJson));

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry).sendTo(eq(session), captor.capture());
            assertThat(captor.getValue().id()).isEqualTo("my-ping-id-456");
        }
    }

    @Nested
    @DisplayName("chat message routing")
    class ChatMessageRoutingTests {

        @Test
        @DisplayName("routes CHAT_MESSAGE to OrchestrationService")
        void handleTextMessage_withChatMessage_routesToOrchestrationService() throws Exception {
            // Arrange
            String chatJson = """
                {
                  "type": "chat:message",
                  "id": "msg-123",
                  "timestamp": 1700000000000,
                  "payload": {
                    "content": "Hello, how are you?",
                    "conversationId": "conv-abc",
                    "model": "claude-3-haiku-20240307",
                    "apiKey": "sk-ant-test"
                  }
                }
                """;

            // Act
            handler.handleTextMessage(session, new TextMessage(chatJson));

            // Assert
            verify(orchestrationService).handleChatMessage(eq(session), any());
        }

        @Test
        @DisplayName("passes correct payload to OrchestrationService")
        void handleTextMessage_withChatMessage_passesCorrectPayload() throws Exception {
            // Arrange
            String chatJson = """
                {
                  "type": "chat:message",
                  "id": "msg-456",
                  "timestamp": 1700000000000,
                  "payload": {
                    "content": "Explain this code",
                    "conversationId": "conv-xyz",
                    "model": "claude-3-opus-20240229"
                  }
                }
                """;

            // Act
            handler.handleTextMessage(session, new TextMessage(chatJson));

            // Assert
            ArgumentCaptor<WsMessage> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(orchestrationService).handleChatMessage(eq(session), captor.capture());

            WsMessage<?> captured = captor.getValue();
            assertThat(captured.type()).isEqualTo(WsMessageTypes.CHAT_MESSAGE);
        }
    }

    @Nested
    @DisplayName("error handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("sends CHAT_ERROR for malformed JSON message")
        void handleTextMessage_withMalformedJson_sendsChatError() throws Exception {
            // Arrange
            String malformedJson = "{ this is not valid json }";

            // Act
            handler.handleTextMessage(session, new TextMessage(malformedJson));

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry).sendTo(eq(session), captor.capture());
            assertThat(captor.getValue().type()).isEqualTo(WsMessageTypes.CHAT_ERROR);
        }

        @Test
        @DisplayName("sends CHAT_ERROR for message with missing type field")
        void handleTextMessage_withMissingType_logsWarningAndDoesNotCrash() throws Exception {
            // Arrange — valid JSON but missing type → empty string → unknown type
            String noTypeJson = """
                {
                  "id": "msg-789",
                  "timestamp": 1700000000000,
                  "payload": {}
                }
                """;

            // Act — should not throw
            handler.handleTextMessage(session, new TextMessage(noTypeJson));

            // Assert: no crash, orchestration service not called
            verify(orchestrationService, never()).handleChatMessage(any(), any());
        }

        @Test
        @DisplayName("logs warning for unknown message type without crashing")
        void handleTextMessage_withUnknownType_doesNotCrash() throws Exception {
            // Arrange
            String unknownTypeJson = """
                {
                  "type": "unknown:type",
                  "id": "msg-999",
                  "timestamp": 1700000000000,
                  "payload": {}
                }
                """;

            // Act — should not throw
            handler.handleTextMessage(session, new TextMessage(unknownTypeJson));

            // Assert: no crash, no routing to services
            verify(orchestrationService, never()).handleChatMessage(any(), any());
        }

        @Test
        @DisplayName("sends CHAT_ERROR when OrchestrationService throws exception")
        void handleTextMessage_whenOrchestrationThrows_sendsChatError() throws Exception {
            // Arrange
            doThrow(new RuntimeException("Unexpected error"))
                .when(orchestrationService).handleChatMessage(any(), any());

            String chatJson = """
                {
                  "type": "chat:message",
                  "id": "msg-err",
                  "timestamp": 1700000000000,
                  "payload": {
                    "content": "Hello",
                    "conversationId": "conv-err"
                  }
                }
                """;

            // Act
            handler.handleTextMessage(session, new TextMessage(chatJson));

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.CHAT_ERROR);
        }
    }
}
