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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("CortexWebSocketHandler API key messages")
class CortexWebSocketHandlerApiKeyTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock private SessionRegistry sessionRegistry;
    @Mock private OrchestrationService orchestrationService;
    @Mock private FileIndexer fileIndexer;
    @Mock private ModelRegistryService modelRegistryService;
    @Mock private AiModelConfig aiModelConfig;
    @Mock private AiModelConfig.Anthropic anthropicConfig;
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
        when(aiModelConfig.getAnthropic()).thenReturn(anthropicConfig);
    }

    @Test
    @DisplayName("config:api-key-set stores anthropic key in config")
    void handleTextMessage_withApiKeySet_updatesAnthropicConfig() throws Exception {
        String message = """
            {
              "type": "config:api-key-set",
              "id": "set-key",
              "timestamp": 1700000000000,
              "payload": {
                "provider": "anthropic",
                "apiKey": "sk-ant-test"
              }
            }
            """;

        handler.handleTextMessage(session, new TextMessage(message));

        verify(anthropicConfig).setApiKey("sk-ant-test");
    }

    @Test
    @DisplayName("config:api-key-test-result payload uses isValid field")
    void handleTextMessage_withApiKeyTest_returnsIsValidField() throws Exception {
        when(anthropicClient.chat(org.mockito.ArgumentMatchers.anyList(), eq("claude-haiku-4-5"), eq("sk-ant-test")))
            .thenReturn("ok");

        String message = """
            {
              "type": "config:api-key-test",
              "id": "test-key",
              "timestamp": 1700000000000,
              "payload": {
                "provider": "anthropic",
                "apiKey": "sk-ant-test"
              }
            }
            """;

        handler.handleTextMessage(session, new TextMessage(message));
        Thread.sleep(250);

        ArgumentCaptor<WsMessage<?>> captor = ArgumentCaptor.forClass(WsMessage.class);
        verify(sessionRegistry, atLeastOnce()).sendTo(eq(session), captor.capture());

        WsMessage<?> testResultMessage = captor.getAllValues().stream()
            .filter(msg -> WsMessageTypes.API_KEY_TEST_RESULT.equals(msg.type()))
            .findFirst()
            .orElseThrow();

        assertThat(testResultMessage.payload()).asString().contains("isValid");
    }
}
