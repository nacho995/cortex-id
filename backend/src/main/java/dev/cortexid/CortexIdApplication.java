package dev.cortexid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Cortex-ID Backend — Local AI-powered IDE server.
 * Runs on port 7432, communicates with Angular frontend via WebSocket.
 */
@SpringBootApplication
@EnableScheduling
public class CortexIdApplication {

    private static final Logger log = LoggerFactory.getLogger(CortexIdApplication.class);

    public static void main(String[] args) {
        ensureDataDirectory();
        SpringApplication.run(CortexIdApplication.class, args);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("Cortex-ID backend ready on port 7432");
        log.info("WebSocket endpoint: ws://localhost:7432/ws");
        log.info("Health endpoint:    http://localhost:7432/api/health");
    }

    private static void ensureDataDirectory() {
        Path dataDir = Path.of(System.getProperty("user.home"), ".cortex-id");
        if (!Files.exists(dataDir)) {
            try {
                Files.createDirectories(dataDir);
                LoggerFactory.getLogger(CortexIdApplication.class)
                    .info("Created data directory: {}", dataDir);
            } catch (IOException e) {
                LoggerFactory.getLogger(CortexIdApplication.class)
                    .warn("Could not create data directory {}: {}", dataDir, e.getMessage());
            }
        }
    }
}
