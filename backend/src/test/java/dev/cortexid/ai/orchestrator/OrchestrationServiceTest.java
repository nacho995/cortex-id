package dev.cortexid.ai.orchestrator;

import dev.cortexid.ai.AgentActionService;
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
    @Mock private AgentActionService agentActionService;
    @Mock private WebSocketSession session;

    private OrchestrationService orchestrationService;

    @BeforeEach
    void setUp() {
        orchestrationService = new OrchestrationService(
            anthropicClient, openAIClient, googleClient, ollamaClient,
            conversationRepository, sessionRegistry, aiModelConfig, agentActionService
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

    private ChatMessagePayload msg(String content, ChatContext ctx, String model, String convId, String key) {
        return new ChatMessagePayload(content, ctx, model, convId, key, "ask");
    }

    private void stubAnthropicComplete() {
        doAnswer(inv -> {
            Runnable onComplete = inv.getArgument(5);
            onComplete.run();
            return null;
        }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());
    }

    @Nested
    @DisplayName("handleChatMessage routing")
    class RoutingTests {

        @Test
        @DisplayName("routes to Anthropic when API key is provided in payload")
        void routesToAnthropic() throws Exception {
            stubAnthropicComplete();
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, msg("Hello", null, null, "conv-1", "sk-ant-key")));
            Thread.sleep(300);
            verify(anthropicClient, timeout(1000)).streamChat(anyList(), anyString(), eq("sk-ant-key"), anyString(), any(), any(), any());
            verify(ollamaClient, never()).streamChat(anyList(), anyString(), any(), any(), any());
        }

        @Test
        @DisplayName("routes to Ollama when Ollama model selected and available")
        void routesToOllama() throws Exception {
            when(ollamaClient.isAvailable()).thenReturn(true);
            doAnswer(inv -> { ((Runnable) inv.getArgument(3)).run(); return null; })
                .when(ollamaClient).streamChat(anyList(), anyString(), any(), any(), any());
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, msg("Hello", null, "llama3", "conv-2", null)));
            Thread.sleep(300);
            verify(ollamaClient, timeout(1000)).streamChat(anyList(), anyString(), any(), any(), any());
            verify(anthropicClient, never()).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());
        }

        @Test
        @DisplayName("sends error when Ollama requested but unavailable")
        void ollamaUnavailableError() throws Exception {
            when(ollamaClient.isAvailable()).thenReturn(false);
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, msg("Hello", null, "llama3", "conv-3", null)));
            Thread.sleep(300);
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());
            assertThat(captor.getAllValues()).extracting(WsMessage::type).contains(WsMessageTypes.CHAT_ERROR);
        }

        @Test
        @DisplayName("generates conversationId when none provided")
        void generatesConversationId() throws Exception {
            stubAnthropicComplete();
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, msg("Hello", null, null, null, "sk-ant-key")));
            Thread.sleep(300);
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());
            assertThat(captor.getAllValues().stream().anyMatch(m -> WsMessageTypes.CHAT_STREAM_START.equals(m.type()))).isTrue();
        }

        @Test
        @DisplayName("uses default model when none specified")
        void usesDefaultModel() throws Exception {
            stubAnthropicComplete();
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, msg("Hello", null, null, "conv-4", "sk-ant-key")));
            Thread.sleep(300);
            verify(anthropicClient, timeout(1000)).streamChat(anyList(), eq("claude-3-haiku-20240307"), anyString(), anyString(), any(), any(), any());
        }
    }

    @Nested
    @DisplayName("streaming")
    class StreamingTests {

        @Test
        @DisplayName("sends STREAM_START, CHUNK, STREAM_END in order")
        void sendsStreamLifecycle() throws Exception {
            doAnswer(inv -> {
                Consumer<String> onChunk = inv.getArgument(4);
                Runnable onComplete = inv.getArgument(5);
                onChunk.accept("Hello ");
                onChunk.accept("world!");
                onComplete.run();
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            ChatMessagePayload payload = msg("Hi", null, null, "conv-5", "sk-ant-key");
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload));
            Thread.sleep(300);

            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());
            List<String> types = captor.getAllValues().stream().map(WsMessage::type).toList();
            assertThat(types).contains(WsMessageTypes.CHAT_STREAM_START, WsMessageTypes.CHAT_STREAM_CHUNK, WsMessageTypes.CHAT_STREAM_END);
            assertThat(captor.getAllValues().stream().filter(m -> WsMessageTypes.CHAT_STREAM_CHUNK.equals(m.type())).count()).isGreaterThanOrEqualTo(2);
        }

        @Test
        @DisplayName("sends AGENT_STATUS thinking and done")
        void sendsAgentStatus() throws Exception {
            stubAnthropicComplete();
            ChatMessagePayload payload = msg("Hi", null, null, "conv-6", "sk-ant-key");
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload));
            Thread.sleep(300);
            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());
            assertThat(captor.getAllValues().stream().filter(m -> WsMessageTypes.AGENT_STATUS.equals(m.type())).count()).isGreaterThanOrEqualTo(2);
        }
    }

    @Nested
    @DisplayName("error handling")
    class ErrorTests {

        @Test
        @DisplayName("sends CHAT_ERROR and STREAM_END when AI fails")
        void sendsErrorAndStreamEnd() throws Exception {
            doAnswer(inv -> {
                Consumer<String> onError = inv.getArgument(6);
                onError.accept("rate limit");
                return null;
            }).when(anthropicClient).streamChat(anyList(), anyString(), anyString(), anyString(), any(), any(), any());

            ChatMessagePayload payload = msg("Hi", null, null, "conv-7", "sk-ant-key");
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload));
            Thread.sleep(300);

            ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
            verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());
            List<String> types = captor.getAllValues().stream().map(WsMessage::type).toList();
            assertThat(types).contains(WsMessageTypes.CHAT_ERROR, WsMessageTypes.CHAT_STREAM_END);
        }
    }

    @Nested
    @DisplayName("conversation context")
    class ContextTests {

        @Test
        @DisplayName("includes history in messages")
        void includesHistory() throws Exception {
            when(conversationRepository.findRecentByConversationId("conv-8", 20)).thenReturn(List.of(
                new ConversationEntity("conv-8", null, "assistant", "Previous answer", "claude-3-haiku-20240307", 0, 0),
                new ConversationEntity("conv-8", null, "user", "Previous question", "claude-3-haiku-20240307", 0, 0)
            ));
            stubAnthropicComplete();
            ChatMessagePayload payload = msg("New", null, null, "conv-8", "sk-ant-key");
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload));
            Thread.sleep(300);
            ArgumentCaptor<List<ConversationMessage>> mc = ArgumentCaptor.forClass(List.class);
            verify(anthropicClient, timeout(1000)).streamChat(mc.capture(), anyString(), anyString(), anyString(), any(), any(), any());
            assertThat(mc.getValue()).hasSizeGreaterThanOrEqualTo(3);
        }

        @Test
        @DisplayName("enriches with file context")
        void enrichesWithContext() throws Exception {
            stubAnthropicComplete();
            ChatContext ctx = new ChatContext("/src/Main.java", "public class Main {}", "java", null);
            ChatMessagePayload payload = msg("Explain", ctx, null, "conv-9", "sk-ant-key");
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload));
            Thread.sleep(300);
            ArgumentCaptor<List<ConversationMessage>> mc = ArgumentCaptor.forClass(List.class);
            verify(anthropicClient, timeout(1000)).streamChat(mc.capture(), anyString(), anyString(), anyString(), any(), any(), any());
            String last = mc.getValue().get(mc.getValue().size() - 1).content();
            assertThat(last).contains("/src/Main.java").contains("public class Main {}");
        }

        @Test
        @DisplayName("saves user and assistant messages")
        void savesMessages() throws Exception {
            stubAnthropicComplete();
            ChatMessagePayload payload = msg("Save me", null, null, "conv-10", "sk-ant-key");
            orchestrationService.handleChatMessage(session, WsMessage.create(WsMessageTypes.CHAT_MESSAGE, payload));
            Thread.sleep(300);
            verify(conversationRepository, timeout(1000).atLeast(2)).save(any(ConversationEntity.class));
        }
    }
}
