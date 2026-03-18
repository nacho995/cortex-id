package dev.cortexid.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Service
public class WhisperService {
    private static final Logger log = LoggerFactory.getLogger(WhisperService.class);
    private static final String WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

    private final AiModelConfig aiModelConfig;
    private final HttpClient httpClient;

    public WhisperService(AiModelConfig aiModelConfig) {
        this.aiModelConfig = aiModelConfig;
        this.httpClient = HttpClient.newHttpClient();
    }

    public String transcribe(byte[] audioData, String language) throws Exception {
        String apiKey = aiModelConfig.getOpenai() != null ? aiModelConfig.getOpenai().getApiKey() : null;
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("OpenAI API key not configured. Set it in Settings → AI Providers.");
        }

        String boundary = "----Boundary" + UUID.randomUUID().toString().replace("-", "");

        // Build multipart form data
        StringBuilder body = new StringBuilder();
        body.append("--").append(boundary).append("\r\n");
        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n");
        body.append("whisper-1\r\n");

        body.append("--").append(boundary).append("\r\n");
        body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n");
        body.append(language != null ? language : "es").append("\r\n");

        body.append("--").append(boundary).append("\r\n");
        body.append("Content-Disposition: form-data; name=\"response_format\"\r\n\r\n");
        body.append("text\r\n");

        // File part header
        String fileHeader = "--" + boundary + "\r\n" +
                "Content-Disposition: form-data; name=\"file\"; filename=\"audio.webm\"\r\n" +
                "Content-Type: audio/webm\r\n\r\n";

        String fileFooter = "\r\n--" + boundary + "--\r\n";

        // Combine text parts + binary audio
        byte[] headerBytes = (body.toString() + fileHeader).getBytes(StandardCharsets.UTF_8);
        byte[] footerBytes = fileFooter.getBytes(StandardCharsets.UTF_8);

        byte[] fullBody = new byte[headerBytes.length + audioData.length + footerBytes.length];
        System.arraycopy(headerBytes, 0, fullBody, 0, headerBytes.length);
        System.arraycopy(audioData, 0, fullBody, headerBytes.length, audioData.length);
        System.arraycopy(footerBytes, 0, fullBody, headerBytes.length + audioData.length, footerBytes.length);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(WHISPER_URL))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(fullBody))
                .build();

        log.info("[Whisper] Sending {}KB audio to OpenAI", audioData.length / 1024);

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("[Whisper] Error {}: {}", response.statusCode(), response.body());
            throw new RuntimeException("Whisper API error: " + response.statusCode());
        }

        String text = response.body().trim();
        log.info("[Whisper] Transcribed: {}", text.substring(0, Math.min(text.length(), 100)));
        return text;
    }
}
