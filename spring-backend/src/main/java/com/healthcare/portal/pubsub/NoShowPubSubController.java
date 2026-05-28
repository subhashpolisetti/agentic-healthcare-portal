package com.healthcare.portal.pubsub;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.TokenVerifier;
import com.healthcare.portal.proxy.AiServiceProxy;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Base64;
import java.util.Map;

/**
 * Receives Pub/Sub push messages for appointment.booked events.
 *
 * In production (Cloud Run): configure a Pub/Sub push subscription pointing to
 *   POST https://<cloud-run-url>/api/v1/internal/pubsub/noshow
 *
 * Pub/Sub wraps the message in:
 * {
 *   "message": { "data": "<base64-encoded-json>", "messageId": "...", "attributes": {...} },
 *   "subscription": "projects/.../subscriptions/..."
 * }
 */
@Slf4j
@RestController
@RequestMapping("/internal/pubsub")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class NoShowPubSubController {

    private final AiServiceProxy aiServiceProxy;
    private final ObjectMapper objectMapper;

    // Optional — only present when REDIS_ENABLED=true; dedup is skipped when null
    @Nullable
    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    @Value("${app.pubsub.enabled:false}")
    private boolean pubsubEnabled;

    @Value("${app.pubsub.project-id:demoprojectaihealthportal}")
    private String projectId;

    // Explicit audience for JWT verification — avoids dynamic getServerName() which can differ
    // across load balancers. Set PUBSUB_AUDIENCE env var in production.
    @Value("${app.pubsub.audience:}")
    private String pubsubAudience;

    @PostMapping("/noshow")
    public void handleNoShowPush(HttpServletRequest request,
                                  @RequestBody Map<String, Object> envelope) {
        // #7: verify GCP-signed JWT — prevents spoofed pushes from the open internet
        if (pubsubEnabled) {
            verifyGcpJwt(request);
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> message = (Map<String, Object>) envelope.get("message");
            if (message == null) {
                log.warn("[PubSub] Received push with no 'message' field");
                return;
            }

            String encodedData = (String) message.get("data");
            if (encodedData == null || encodedData.isBlank()) {
                log.warn("[PubSub] Pub/Sub message has empty data");
                return;
            }

            String messageId = (String) message.get("messageId");

            // #7: Redis dedup — Pub/Sub guarantees at-least-once; skip if already processed
            if (isDuplicate(messageId)) {
                log.info("[PubSub] Skipping duplicate messageId={}", messageId);
                return;
            }

            byte[] decoded = Base64.getDecoder().decode(encodedData);
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(decoded, Map.class);

            log.info("[PubSub] Received appointment.booked push — apptId={}, msgId={}",
                    payload.get("appointment_id"), messageId);

            aiServiceProxy.predictNoShowRisk(payload);

        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            // Return 2xx to prevent Pub/Sub from redelivering a malformed message
            log.error("[PubSub] Failed to process noshow push: {}", e.getMessage());
        }
    }

    private void verifyGcpJwt(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing Authorization header");
        }
        String token = auth.substring(7);
        // Use configured audience; fall back to dynamic only if not set (local dev).
        String audience = pubsubAudience != null && !pubsubAudience.isBlank()
                ? pubsubAudience
                : "https://" + request.getServerName() + "/api/v1/internal/pubsub/noshow";
        try {
            TokenVerifier.newBuilder()
                    .setAudience(audience)
                    .build()
                    .verify(token);
        } catch (TokenVerifier.VerificationException e) {
            log.warn("[PubSub] JWT verification failed (audience={}): {}", audience, e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid GCP JWT");
        }
    }

    private boolean isDuplicate(String messageId) {
        if (messageId == null || redisTemplate == null) return false;
        // SET NX with 24h TTL — returns false (not duplicate) if key was newly set
        Boolean inserted = redisTemplate.opsForValue()
                .setIfAbsent("pubsub:msg:" + messageId, "1", Duration.ofHours(24));
        return !Boolean.TRUE.equals(inserted);
    }
}
