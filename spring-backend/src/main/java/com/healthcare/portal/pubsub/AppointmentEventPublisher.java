package com.healthcare.portal.pubsub;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Publishes appointment.booked events to GCP Pub/Sub.
 *
 * Activated by PUBSUB_ENABLED=true (Cloud Run only).
 * Local dev: disabled by default — NoShowEventListener uses direct HTTP to AI service.
 *
 * Production deployment: re-enable google-cloud-pubsub dependency in build.gradle.kts
 * and uncomment the full publisher implementation.
 */
@Slf4j
@Service
public class AppointmentEventPublisher {

    private final String projectId;
    private final String topicId;
    private final boolean enabled;

    public AppointmentEventPublisher(
            @Value("${app.pubsub.project-id:}") String projectId,
            @Value("${app.pubsub.topic-appointment-booked:appointment.booked}") String topicId,
            @Value("${app.pubsub.enabled:false}") boolean enabled,
            ObjectMapper objectMapper) {
        this.projectId = projectId;
        this.topicId   = topicId;
        this.enabled   = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void publishAppointmentBooked(Map<String, Object> payload) {
        if (!enabled) {
            log.debug("Pub/Sub disabled — skipping publish for appointment {}",
                    payload.get("appointment_id"));
            return;
        }
        // TODO: re-enable google-cloud-pubsub in build.gradle.kts for production deployment
        // Full implementation: Publisher.newBuilder(TopicName.of(projectId, topicId)).build()
        log.warn("PUBSUB_ENABLED=true but google-cloud-pubsub dependency is commented out. " +
                "Re-enable it in build.gradle.kts for production.");
    }
}
