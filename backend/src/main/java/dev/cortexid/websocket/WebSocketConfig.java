package dev.cortexid.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket configuration.
 * Registers the /ws endpoint with allowed origins for Angular dev server
 * and Electron file:// protocol.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CortexWebSocketHandler webSocketHandler;

    public WebSocketConfig(CortexWebSocketHandler webSocketHandler) {
        this.webSocketHandler = webSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(webSocketHandler, "/ws")
            .setAllowedOrigins(
                "http://localhost:4200",   // Angular dev server
                "http://localhost:4201",   // Angular alt port
                "file://*",               // Electron production (file:// protocol)
                "null"                    // Electron file:// sends "null" origin
            );
    }
}
