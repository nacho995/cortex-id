package dev.cortexid.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe registry of active WebSocket sessions.
 * Provides broadcast and targeted send capabilities.
 */
@Component
public class SessionRegistry {

    private static final Logger log = LoggerFactory.getLogger(SessionRegistry.class);

    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public SessionRegistry(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void register(WebSocketSession session) {
        sessions.put(session.getId(), session);
        log.debug("Session registered: {} (total: {})", session.getId(), sessions.size());
    }

    public void unregister(WebSocketSession session) {
        sessions.remove(session.getId());
        log.debug("Session unregistered: {} (total: {})", session.getId(), sessions.size());
    }

    public Collection<WebSocketSession> all() {
        return sessions.values();
    }

    public int count() {
        return sessions.size();
    }

    /**
     * Send a typed WsMessage to a specific session.
     */
    public <T> void sendTo(WebSocketSession session, WsMessage<T> message) {
        if (!session.isOpen()) {
            log.warn("Attempted to send to closed session: {}", session.getId());
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(message);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            log.error("Failed to send message to session {}: {}", session.getId(), e.getMessage());
        }
    }

    /**
     * Broadcast a typed WsMessage to all connected sessions.
     */
    public <T> void broadcast(WsMessage<T> message) {
        if (sessions.isEmpty()) return;
        try {
            String json = objectMapper.writeValueAsString(message);
            TextMessage textMessage = new TextMessage(json);
            for (WebSocketSession session : sessions.values()) {
                if (session.isOpen()) {
                    try {
                        synchronized (session) {
                            session.sendMessage(textMessage);
                        }
                    } catch (IOException e) {
                        log.warn("Failed to broadcast to session {}: {}", session.getId(), e.getMessage());
                    }
                }
            }
        } catch (IOException e) {
            log.error("Failed to serialize broadcast message: {}", e.getMessage());
        }
    }
}
