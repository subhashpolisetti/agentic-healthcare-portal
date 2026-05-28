package com.healthcare.portal.monitoring;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "monitoring_session")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonitoringSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "appointment_id", nullable = false, unique = true)
    private Long appointmentId;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MonitoringSessionStatus status = MonitoringSessionStatus.ACTIVE;
}
