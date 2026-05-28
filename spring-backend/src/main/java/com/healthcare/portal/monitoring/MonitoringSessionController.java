package com.healthcare.portal.monitoring;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/internal/monitoring")
@RequiredArgsConstructor
public class MonitoringSessionController {

    private final MonitoringSessionService monitoringSessionService;

    @PostMapping
    public ResponseEntity<Void> startSession(@RequestBody Map<String, Long> body) {
        Long appointmentId = body.get("appointment_id");
        monitoringSessionService.startSession(appointmentId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{appointmentId}")
    public ResponseEntity<Void> endSession(@PathVariable Long appointmentId) {
        monitoringSessionService.endSession(appointmentId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/active")
    public ResponseEntity<Map<String, List<Long>>> getActive() {
        return ResponseEntity.ok(Map.of("appointment_ids", monitoringSessionService.getActiveAppointmentIds()));
    }
}
