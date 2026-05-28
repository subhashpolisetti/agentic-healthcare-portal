package com.healthcare.portal.monitoring;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonitoringSessionRepository extends JpaRepository<MonitoringSession, Long> {

    Optional<MonitoringSession> findByAppointmentIdAndStatus(Long appointmentId, MonitoringSessionStatus status);

    Optional<MonitoringSession> findByAppointmentId(Long appointmentId);

    List<MonitoringSession> findByStatus(MonitoringSessionStatus status);
}
