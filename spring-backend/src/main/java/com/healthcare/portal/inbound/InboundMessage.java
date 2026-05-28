package com.healthcare.portal.inbound;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "inbound_message")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InboundMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "from_channel", nullable = false, length = 10)
    private String fromChannel;   // SMS | EMAIL

    @Column(name = "from_address", nullable = false)
    private String fromAddress;

    @Column(name = "patient_id")
    private Long patientId;

    @Column(name = "appointment_id")
    private Long appointmentId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    @Column(length = 30)
    private String classification;  // RECOVERY_NORMAL | NEEDS_HELP | RESCHEDULE_REQUEST | URGENT | UNRELATED

    @Column(nullable = false, length = 15)
    @Builder.Default
    private String status = "NEW";  // NEW | CLASSIFIED | ROUTED | CLOSED | NEEDS_REVIEW

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private LocalDateTime receivedAt;
}
