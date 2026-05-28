package com.healthcare.portal.monitoring;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MonitoringSessionService {

    private final MonitoringSessionRepository repository;

    @Transactional
    public MonitoringSession startSession(Long appointmentId) {
        // Upsert: if a session exists (ACTIVE or ENDED), reactivate it; otherwise create new
        return repository.findByAppointmentId(appointmentId)
                .map(existing -> {
                    existing.setStatus(MonitoringSessionStatus.ACTIVE);
                    existing.setEndedAt(null);
                    log.info("[Monitoring] Reactivated session for appointment {}", appointmentId);
                    return repository.save(existing);
                })
                .orElseGet(() -> {
                    MonitoringSession session = MonitoringSession.builder()
                            .appointmentId(appointmentId)
                            .status(MonitoringSessionStatus.ACTIVE)
                            .build();
                    log.info("[Monitoring] Started new session for appointment {}", appointmentId);
                    return repository.save(session);
                });
    }

    @Transactional
    public void endSession(Long appointmentId) {
        repository.findByAppointmentIdAndStatus(appointmentId, MonitoringSessionStatus.ACTIVE)
                .ifPresent(session -> {
                    session.setStatus(MonitoringSessionStatus.ENDED);
                    session.setEndedAt(LocalDateTime.now());
                    repository.save(session);
                    log.info("[Monitoring] Ended session for appointment {}", appointmentId);
                });
    }

    public List<Long> getActiveAppointmentIds() {
        return repository.findByStatus(MonitoringSessionStatus.ACTIVE)
                .stream()
                .map(MonitoringSession::getAppointmentId)
                .toList();
    }
}
