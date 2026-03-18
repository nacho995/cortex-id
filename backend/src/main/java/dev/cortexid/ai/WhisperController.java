package dev.cortexid.ai;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/whisper")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost:4201"})
public class WhisperController {

    private final WhisperService whisperService;

    public WhisperController(WhisperService whisperService) {
        this.whisperService = whisperService;
    }

    @PostMapping("/transcribe")
    public ResponseEntity<Map<String, String>> transcribe(
            @RequestParam("audio") MultipartFile audio,
            @RequestParam(value = "language", defaultValue = "es") String language) {
        try {
            String text = whisperService.transcribe(audio.getBytes(), language);
            return ResponseEntity.ok(Map.of("text", text));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Transcription failed: " + e.getMessage()));
        }
    }
}
