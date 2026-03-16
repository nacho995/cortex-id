package dev.cortexid.ai.orchestrator;

import dev.cortexid.ai.AiModelConfig;
import dev.cortexid.ai.AnthropicClient;
import dev.cortexid.ai.AnthropicClient.ConversationMessage;
import dev.cortexid.ai.GoogleClient;
import dev.cortexid.ai.OllamaClient;
import dev.cortexid.ai.OpenAIClient;
import dev.cortexid.memory.ConversationEntity;
import dev.cortexid.memory.ConversationRepository;
import dev.cortexid.websocket.SessionRegistry;
import dev.cortexid.websocket.WsMessage;
import dev.cortexid.websocket.WsMessageTypes;
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
import org.springframework.web.socket.WebSocketSession;

import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for OrchestrationService.
 * Verifies routing logic, streaming, and error handling.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("OrchestrationService")
class OrchestrationServiceTest {

    @Mock private AnthropicClient anthropicClient;
    @Mock private OpenAIClient openAIClient;
    @Mock private GoogleClient googleClient;
    @Mock private OllamaClient ollamaClient;
    @Mock private ConversationRepository conversationRepository;
    @Mock private SessionRegistry sessionRegistry;
    @Mock private AiModelConfig aiModelConfig;
    @Mock private AiModelConfig.Anthropic anthropicConfig;
    @Mock private AiModelConfig.OpenAI openAIConfig;
    @Mock private AiModelConfig.Google googleConfig;
    @Mock private WebSocketSession session;

    private OrchestrationService orchestrationService;

    @BeforeEach
    void setUp() {
        orchestrationService = new OrchestrationService(
            anthropicClient, openAIClient, googleClient, ollamaClient,
            conversationRepository, sessionRegistry, aiModelConfig
        );
        when(session.isOpen()).thenReturn(true);
        when(session.getId()).thenReturn("test-session-id");
        when(aiModelConfig.getDefaultModel()).thenReturn("claude-3-haiku-20240307");
        when(aiModelConfig.getAnthropic()).thenReturn(anthropicConfig);
        when(aiModelConfig.getOpenai()).thenReturn(openAIConfig);
        when(aiModelConfig.getGoogle()).thenReturn(googleConfig);
        when(anthropicConfig.getApiKey()).thenReturn(null);
        when(openAIConfig.getApiKey()).thenReturn(null);
        when(googleConfig.getApiKey()).thenReturn(null);
        when(conversationRepository.findRecentByConversationId(anyString(), anyInt()))
            .thenReturn(List.of());
    }

    @Nested
    @DisplayName("handleChatMessage routing")
    class RoutingTests {

        @Test
        @DisplayName("routes to Anthropic when API key is provided in payload")
        void handleChatMessage_withApiKeyInPayload_routesToAnthropic() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-test-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200); // allow async to complete

            // Assert
            verify(anthropicClient, timeout(1000)).streamChat(
                anyList(), anyString(), eq("sk-ant-test-key"), anyString(), any(), any(), any()
            );
            verify(ollamaClient, never()).streamChat(anyList(), anyString(), any(), any(), any());
        }

        @Test
        @DisplayName("routes to Ollama when model is an Ollama model and Ollama is available")
        void handleChatMessage_withNoApiKeyAndOllamaAvailable_routesToOllama() throws Exception {
            // Arrange: use an Ollama model (not claude-*, gpt-*, gemini-*)
            when(ollamaClient.isAvailable()).thenReturn(true);

            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, "llama3", "conv-456", null
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(3);
                onComplete.run();
                return null;
            }).when(ollamaClient).streamChat(anyList(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert
            verify(ollamaClient, timeout(1000)).streamChat(anyList(), anyString(), any(), any(), any());
            verify(anthropicClient, never()).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());
        }

        @Test
        @DisplayName("sends friendly error when Ollama model requested but Ollama is unavailable")
        void handleChatMessage_withNoApiKeyAndOllamaUnavailable_routesToAnthropic() throws Exception {
            // Arrange: use an Ollama model but Ollama is not running
            when(ollamaClient.isAvailable()).thenReturn(false);

            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, "llama3", "conv-789", null
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert: a CHAT_ERROR is sent with a friendly message
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());
            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.CHAT_ERROR);
            // Anthropic should NOT be called — Ollama model was requested
            verify(anthropicClient, never()).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());
        }

        @Test
        @DisplayName("generates new conversationId when none provided")
        void handleChatMessage_withNullConversationId_generatesNewId() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, null, "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert: stream start is sent with a generated conversationId
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            boolean hasStreamStart = captor.getAllValues().stream()
                .anyMatch(m -> WsMessageTypes.CHAT_STREAM_START.equals(m.type()));
            assertThat(hasStreamStart).isTrue();
        }

        @Test
        @DisplayName("uses default model when none specified in payload")
        void handleChatMessage_withNullModel_usesDefaultModel() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert: called with the default model
            verify(anthropicClient, timeout(1000)).streamChat(
                anyList(), eq("claude-3-haiku-20240307"), anyString(), anyString(), any(), any(), any()
            );
        }
    }

    @Nested
    @DisplayName("streaming WebSocket messages")
    class StreamingTests {

        @Test
        @DisplayName("sends CHAT_STREAM_START before streaming begins")
        void handleChatMessage_shouldSendStreamStart() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.CHAT_STREAM_START);
        }

        @Test
        @DisplayName("sends CHAT_STREAM_CHUNK for each text delta")
        void handleChatMessage_shouldSendStreamChunks() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Consumer<String> onChunk = inv.getArgument(4);
                Runnable onComplete = inv.getArgument(5);
                onChunk.accept("Hello ");
                onChunk.accept("world!");
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            long chunkCount = captor.getAllValues().stream()
                .filter(m -> WsMessageTypes.CHAT_STREAM_CHUNK.equals(m.type()))
                .count();
            assertThat(chunkCount).isGreaterThanOrEqualTo(2);
        }

        @Test
        @DisplayName("sends CHAT_STREAM_END after streaming completes")
        void handleChatMessage_shouldSendStreamEnd() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.CHAT_STREAM_END);
        }

        @Test
        @DisplayName("sends AGENT_STATUS thinking before and done after streaming")
        void handleChatMessage_shouldSendAgentStatusUpdates() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            long agentStatusCount = captor.getAllValues().stream()
                .filter(m -> WsMessageTypes.AGENT_STATUS.equals(m.type()))
                .count();
            assertThat(agentStatusCount).isGreaterThanOrEqualTo(2); // thinking + done
        }
    }

    @Nested
    @DisplayName("error handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("sends CHAT_ERROR when AI client fails")
        void handleChatMessage_whenAiClientFails_sendsChatError() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Consumer<String> onError = inv.getArgument(6);
                onError.accept("API rate limit exceeded");
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.CHAT_ERROR);
        }

        @Test
        @DisplayName("sends CHAT_STREAM_END even when AI client fails")
        void handleChatMessage_whenAiClientFails_stillSendsStreamEnd() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Hello", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Consumer<String> onError = inv.getArgument(6);
                onError.accept("Connection timeout");
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

            assertThat(captor.getAllValues())
                .extracting(WsMessage::type)
                .contains(WsMessageTypes.CHAT_STREAM_END);
        }
    }

    @Nested
    @DisplayName("conversation context")
    class ConversationContextTests {

        @Test
        @DisplayName("loads conversation history and includes it in messages")
        void handleChatMessage_withExistingHistory_includesHistoryInMessages() throws Exception {
            // Arrange
            ConversationEntity userMsg = new ConversationEntity(
                "conv-123", null, "user", "Previous question", "claude-3-haiku-20240307", 0, 0
            );
            ConversationEntity assistantMsg = new ConversationEntity(
                "conv-123", null, "assistant", "Previous answer", "claude-3-haiku-20240307", 0, 0
            );
            when(conversationRepository.findRecentByConversationId("conv-123", 20))
                .thenReturn(List.of(assistantMsg, userMsg)); // DESC order from DB

            ChatMessagePayload payload = new ChatMessagePayload(
                "New question", null, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert: messages list includes history + new message
            ArgumentCaptor<List<ConversationMessage>> messagesCaptor = ArgumentCaptor.forClass(List.class);
            verify(anthropicClient, timeout(1000)).streamChat(
                messagesCaptor.capture(), anyString(), anyString(), anyString(), any(), any(), any()
            );

            List<ConversationMessage> sentMessages = messagesCaptor.getValue();
            assertThat(sentMessages).hasSizeGreaterThanOrEqualTo(3); // 2 history + 1 new
        }

        @Test
        @DisplayName("enriches message with file context when provided")
        void handleChatMessage_withFileContext_enrichesContent() throws Exception {
            // Arrange
            ChatContext context = new ChatContext("/project/src/Main.java", "public class Main {}", "java");
            ChatMessagePayload payload = new ChatMessagePayload(
                "Explain this", context, null, "conv-123", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert: last message content contains file path and code
            ArgumentCaptor<List<ConversationMessage>> messagesCaptor = ArgumentCaptor.forClass(List.class);
            verify(anthropicClient, timeout(1000)).streamChat(
                messagesCaptor.capture(), anyString(), anyString(), anyString(), any(), any(), any()
            );

            List<ConversationMessage> sentMessages = messagesCaptor.getValue();
            String lastContent = sentMessages.get(sentMessages.size() - 1).content();
            assertThat(lastContent).contains("/project/src/Main.java");
            assertThat(lastContent).contains("public class Main {}");
        }

        @Test
        @DisplayName("saves user message to conversation history")
        void handleChatMessage_shouldSaveUserMessageToRepository() throws Exception {
            // Arrange
            ChatMessagePayload payload = new ChatMessagePayload(
                "Save this message", null, null, "conv-save", "sk-ant-key"
            );
            WsMessage<ChatMessagePayload> message = WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload);

            doAnswer(inv -> {
                Runnable onComplete = inv.getArgument(5);
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            // Act
            orchestrationService.handleChatMessage(session, message);
            Thread.sleep(200);

            // Assert: save called at least twice (user + assistant)
            verify(conversationRepository, timeout(1000).atLeast(2)).save(any(ConversationEntity.class));
        }
    }
}
