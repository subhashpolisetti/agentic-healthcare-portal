package com.healthcare.portal.vitals;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class VitalsWebSocketConfig implements WebSocketConfigurer {

    private final VitalsWebSocketHandler vitalsWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        // Explicit /api/v1 prefix because context-path doesn't apply to WebSocket
        registry.addHandler(vitalsWebSocketHandler, "/api/v1/emergency/vitals/ws")
                .setAllowedOriginPatterns("*");
    }
}
