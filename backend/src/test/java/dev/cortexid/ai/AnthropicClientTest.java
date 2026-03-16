package dev.cortexid.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import dev.cortexid.ai.AnthropicClient.ConversationMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for AnthropicClient.
 * Uses an embedded HTTP server per test to verify request building, SSE parsing, and error handling.
 */
@DisplayName("AnthropicClient")
class AnthropicClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Creates a fresh HTTP server, runs the test body, then stops the server.
     * Each test gets its own server to avoid context registration conflicts.
     */
    private void withServer(HttpHandler handler, ServerTest test) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        // AnthropicClient calls: config.getAnthropic().getApiUrl() + "/messages"
        // We set apiUrl to "http://localhost:{port}" so the path becomes "/messages"
        server.createContext("/messages", handler);
        server.start();
        int port = server.getAddress().getPort();

        AiModelConfig config = new AiModelConfig();
        config.getAnthropic().setApiUrl("http://localhost:" + port);
        AnthropicClient client = new AnthropicClient(objectMapper, config);

        try {
            test.run(client);
        } finally {
            server.stop(0);
        }
    }

    @FunctionalInterface
    interface ServerTest {
        void run(AnthropicClient client) throws Exception;
    }

    // ── Request building ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("streamChat — request building")
    class RequestBuildingTests {

        @Test
        @DisplayName("sends correct Anthropic headers in request")
        void streamChat_shouldSendCorrectHeaders() throws Exception {
            AtomicReference<String> capturedApiKey = new AtomicReference<>();
            AtomicReference<String> capturedVersion = new AtomicReference<>();
            AtomicReference<String> capturedContentType = new AtomicReference<>();

            withServer(exchange -> {
                capturedApiKey.set(exchange.getRequestHeaders().getFirst("x-api-key"));
                capturedVersion.set(exchange.getRequestHeaders().getFirst("anthropic-version"));
                capturedContentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));

                byte[] bytes = "data: [DONE]\n".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                CountDownLatch latch = new CountDownLatch(1);
                client.streamChat(
                    List.of(new ConversationMessage("user", "Hello")),
                    "claude-3-haiku-20240307", "sk-ant-test-key", null,
                    chunk -> {}, latch::countDown, error -> latch.countDown()
                );
                assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
            });

            assertThat(capturedApiKey.get()).isEqualTo("sk-ant-test-key");
            assertThat(capturedVersion.get()).isEqualTo("2023-06-01");
            assertThat(capturedContentType.get()).isEqualTo("application/json");
        }

        @Test
        @DisplayName("request body contains model, messages, and stream=true")
        void streamChat_shouldBuildCorrectRequestBody() throws Exception {
            AtomicReference<String> capturedBody = new AtomicReference<>();

            withServer(exchange -> {
                byte[] bodyBytes = exchange.getRequestBody().readAllBytes();
                capturedBody.set(new String(bodyBytes, StandardCharsets.UTF_8));

                byte[] bytes = "data: [DONE]\n".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                CountDownLatch latch = new CountDownLatch(1);
                client.streamChat(
                    List.of(new ConversationMessage("user", "Test message")),
                    "claude-3-opus-20240229", "sk-ant-key", null,
                    chunk -> {}, latch::countDown, error -> latch.countDown()
                );
                assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
            });

            var bodyNode = objectMapper.readTree(capturedBody.get());
            assertThat(bodyNode.path("model").asText()).isEqualTo("claude-3-opus-20240229");
            assertThat(bodyNode.path("stream").asBoolean()).isTrue();
            assertThat(bodyNode.path("max_tokens").asInt()).isGreaterThan(0);
            assertThat(bodyNode.path("messages").isArray()).isTrue();
            assertThat(bodyNode.path("messages").size()).isEqualTo(1);
            assertThat(bodyNode.path("messages").get(0).path("role").asText()).isEqualTo("user");
            assertThat(bodyNode.path("messages").get(0).path("content").asText()).isEqualTo("Test message");
        }
    }

    // ── SSE parsing ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("streamChat — SSE parsing")
    class SseParsing {

        @Test
        @DisplayName("parses content_block_delta events and calls onChunk")
        void streamChat_withValidSseResponse_callsOnChunkForEachDelta() throws Exception {
            String sseResponse = String.join("\n",
                "data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\"}}",
                "",
                "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Hello \"}}",
                "",
                "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"world!\"}}",
                "",
                "data: [DONE]",
                ""
            );

            List<String> chunks = new ArrayList<>();
            CountDownLatch latch = new CountDownLatch(1);

            withServer(exchange -> {
                byte[] bytes = sseResponse.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                client.streamChat(
                    List.of(new ConversationMessage("user", "Hi")),
                    null, "sk-ant-key", null,
                    chunks::add, latch::countDown, error -> latch.countDown()
                );
                assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
            });

            assertThat(chunks).containsExactly("Hello ", "world!");
        }

        @Test
        @DisplayName("ignores non-text SSE events silently")
        void streamChat_withNonTextEvents_ignoresThem() throws Exception {
            String sseResponse = String.join("\n",
                "data: {\"type\":\"message_start\",\"message\":{}}",
                "",
                "data: {\"type\":\"content_block_start\",\"content_block\":{\"type\":\"text\"}}",
                "",
                "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Only this\"}}",
                "",
                "data: {\"type\":\"message_stop\"}",
                "",
                "data: [DONE]",
                ""
            );

            List<String> chunks = new ArrayList<>();
            CountDownLatch latch = new CountDownLatch(1);

            withServer(exchange -> {
                byte[] bytes = sseResponse.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                client.streamChat(
                    List.of(new ConversationMessage("user", "Hi")),
                    null, "sk-ant-key", null,
                    chunks::add, latch::countDown, error -> latch.countDown()
                );
                assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
            });

            assertThat(chunks).containsExactly("Only this");
        }

        @Test
        @DisplayName("calls onComplete after all SSE events are processed")
        void streamChat_shouldCallOnCompleteAfterStream() throws Exception {
            String sseResponse = "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Hi\"}}\n\ndata: [DONE]\n";

            CountDownLatch completeLatch = new CountDownLatch(1);
            AtomicReference<String> errorRef = new AtomicReference<>();

            withServer(exchange -> {
                byte[] bytes = sseResponse.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                client.streamChat(
                    List.of(new ConversationMessage("user", "Hi")),
                    null, "sk-ant-key", null,
                    chunk -> {}, completeLatch::countDown, error -> errorRef.set(error)
                );
                assertThat(completeLatch.await(3, TimeUnit.SECONDS)).isTrue();
                assertThat(errorRef.get()).isNull();
            });
        }
    }

    // ── Error handling ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("streamChat — error handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("calls onError immediately when no API key is configured")
        void streamChat_withNoApiKey_callsOnErrorWithoutHttpCall() throws Exception {
            // No server needed — error is triggered before any HTTP call
            AiModelConfig config = new AiModelConfig();
            config.getAnthropic().setApiKey(null);
            AnthropicClient client = new AnthropicClient(objectMapper, config);

            AtomicReference<String> errorRef = new AtomicReference<>();
            CountDownLatch latch = new CountDownLatch(1);

            client.streamChat(
                List.of(new ConversationMessage("user", "Hello")),
                null, null, null,
                chunk -> {}, () -> {}, error -> { errorRef.set(error); latch.countDown(); }
            );

            assertThat(latch.await(1, TimeUnit.SECONDS)).isTrue();
            assertThat(errorRef.get()).containsIgnoringCase("API key");
        }

        @Test
        @DisplayName("calls onError with status code on HTTP 401 Unauthorized")
        void streamChat_with401Response_callsOnError() throws Exception {
            String errorBody = "{\"error\":{\"type\":\"authentication_error\",\"message\":\"Invalid API key\"}}";
            AtomicReference<String> errorRef = new AtomicReference<>();
            CountDownLatch latch = new CountDownLatch(1);

            withServer(exchange -> {
                byte[] bytes = errorBody.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(401, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                client.streamChat(
                    List.of(new ConversationMessage("user", "Hi")),
                    null, "bad-key", null,
                    chunk -> {}, () -> {}, error -> { errorRef.set(error); latch.countDown(); }
                );
                assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
            });

            assertThat(errorRef.get()).contains("401");
        }

        @Test
        @DisplayName("calls onError with status code on HTTP 429 Rate Limit")
        void streamChat_with429Response_callsOnError() throws Exception {
            String errorBody = "{\"error\":{\"type\":\"rate_limit_error\",\"message\":\"Rate limit exceeded\"}}";
            AtomicReference<String> errorRef = new AtomicReference<>();
            CountDownLatch latch = new CountDownLatch(1);

            withServer(exchange -> {
                byte[] bytes = errorBody.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(429, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                client.streamChat(
                    List.of(new ConversationMessage("user", "Hi")),
                    null, "valid-key", null,
                    chunk -> {}, () -> {}, error -> { errorRef.set(error); latch.countDown(); }
                );
                assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
            });

            assertThat(errorRef.get()).contains("429");
        }

        @Test
        @DisplayName("calls onError with status code on HTTP 500 Server Error")
        void streamChat_with500Response_callsOnError() throws Exception {
            String errorBody = "{\"error\":{\"type\":\"api_error\",\"message\":\"Internal server error\"}}";
            AtomicReference<String> errorRef = new AtomicReference<>();
            CountDownLatch latch = new CountDownLatch(1);

            withServer(exchange -> {
                byte[] bytes = errorBody.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(500, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                client.streamChat(
                    List.of(new ConversationMessage("user", "Hi")),
                    null, "valid-key", null,
                    chunk -> {}, () -> {}, error -> { errorRef.set(error); latch.countDown(); }
                );
                assertThat(latch.await(3, TimeUnit.SECONDS)).isTrue();
            });

            assertThat(errorRef.get()).contains("500");
        }
    }

    // ── Non-streaming chat ────────────────────────────────────────────────────

    @Nested
    @DisplayName("chat (non-streaming)")
    class ChatTests {

        @Test
        @DisplayName("throws IllegalStateException when no API key configured")
        void chat_withNoApiKey_throwsIllegalStateException() {
            AiModelConfig config = new AiModelConfig();
            config.getAnthropic().setApiKey(null);
            AnthropicClient client = new AnthropicClient(objectMapper, config);

            assertThatThrownBy(() ->
                client.chat(List.of(new ConversationMessage("user", "Hi")), null, null)
            ).isInstanceOf(IllegalStateException.class)
             .hasMessageContaining("API key");
        }

        @Test
        @DisplayName("returns text content from successful response")
        void chat_withValidResponse_returnsTextContent() throws Exception {
            String responseBody = """
                {
                  "id": "msg_123",
                  "type": "message",
                  "content": [{"type": "text", "text": "Hello from Claude!"}],
                  "model": "claude-3-haiku-20240307",
                  "stop_reason": "end_turn"
                }
                """;

            AtomicReference<String> resultRef = new AtomicReference<>();

            withServer(exchange -> {
                byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                String result = client.chat(
                    List.of(new ConversationMessage("user", "Hi")),
                    null, "sk-ant-key"
                );
                resultRef.set(result);
            });

            assertThat(resultRef.get()).isEqualTo("Hello from Claude!");
        }

        @Test
        @DisplayName("throws RuntimeException on non-200 response")
        void chat_withErrorResponse_throwsRuntimeException() throws Exception {
            withServer(exchange -> {
                byte[] bytes = "error".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(500, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
            }, client -> {
                assertThatThrownBy(() ->
                    client.chat(
                        List.of(new ConversationMessage("user", "Hi")),
                        null, "sk-ant-key"
                    )
                ).isInstanceOf(RuntimeException.class);
            });
        }
    }
}
