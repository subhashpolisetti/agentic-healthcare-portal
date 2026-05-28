package com.healthcare.portal.vitals;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class VitalsWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    private final Random random = new Random();

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        log.info("Vitals WebSocket connected: {}", session.getId());

        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
            try {
                if (session.isOpen()) {
                    String payload = objectMapper.writeValueAsString(generateVitals());
                    session.sendMessage(new TextMessage((CharSequence) payload));
                }
            } catch (Exception e) {
                log.error("Error sending vitals to {}: {}", session.getId(), e.getMessage());
            }
        }, 0, 850, TimeUnit.MILLISECONDS);

        session.getAttributes().put("task", task);
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        log.info("Vitals WebSocket disconnected: {}", session.getId());
        ScheduledFuture<?> task = (ScheduledFuture<?>) session.getAttributes().get("task");
        if (task != null) task.cancel(true);
    }

    private Map<String, Object> generateVitals() {
        int hr       = 65 + random.nextInt(40);   // 65–105
        double spo2  = 94.0 + random.nextDouble() * 6;  // 94–100
        int systolic = 100 + random.nextInt(60);  // 100–160
        int diastolic = 60 + random.nextInt(30);  // 60–90
        int rr       = 12 + random.nextInt(10);   // 12–22
        double temp  = 97.5 + random.nextDouble() * 3;  // 97.5–100.5

        String urgency;
        boolean alert;
        String message = null;

        if (hr > 100 || spo2 < 95 || systolic > 140 || temp > 99.5) {
            urgency = "high";
            alert = true;
            message = hr > 100 ? "Elevated heart rate" :
                      spo2 < 95 ? "Low SpO2 detected" :
                      systolic > 140 ? "High blood pressure" : "Elevated temperature";
        } else if (spo2 < 93 || hr > 110 || systolic > 150) {
            urgency = "critical";
            alert = true;
            message = "Critical vitals — immediate attention required";
        } else {
            urgency = "normal";
            alert = false;
        }

        return Map.of(
            "ts", System.currentTimeMillis(),
            "vitals", Map.of(
                "heart_rate_bpm", hr,
                "spo2_pct", Math.round(spo2 * 10.0) / 10.0,
                "blood_pressure", systolic + "/" + diastolic,
                "respiratory_rate", rr,
                "temperature_f", Math.round(temp * 10.0) / 10.0
            ),
            "urgency", urgency,
            "alert", alert,
            "message", message != null ? message : ""
        );
    }
}
