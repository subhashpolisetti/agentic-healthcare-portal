package com.healthcare.portal.appointment;

import com.healthcare.portal.doctor.Doctor;
import com.healthcare.portal.user.AppUser;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(
    name = "appointments",
    uniqueConstraints = @UniqueConstraint(columnNames = {"doctor_id", "appointment_date", "slot_start_time"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private AppUser patient;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate appointmentDate;

    @Column(name = "slot_start_time", nullable = false)
    private LocalTime slotStartTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AppointmentStatus status = AppointmentStatus.BOOKED;

    @Column(name = "discharged_at")
    private LocalDateTime dischargedAt;

    @Column(name = "noshow_risk", precision = 4, scale = 2)
    private BigDecimal noshowRisk;

    @Column(name = "discharge_summary", columnDefinition = "TEXT")
    private String dischargeSummary;

    @Column(name = "chief_complaint", columnDefinition = "TEXT")
    private String chiefComplaint;

    @Column(name = "soap_notes", columnDefinition = "TEXT")
    private String soapNotes;

    @Column(name = "followup_sent_at")
    private LocalDateTime followupSentAt;

    // B2: idempotency — set before triggering no-show agent; skip if already set on re-delivery
    @Column(name = "noshow_triggered_at")
    private LocalDateTime noshowTriggeredAt;

    // L2: audit trail — LLM-generated intervention message sent to patient
    @Column(name = "intervention_message", columnDefinition = "TEXT")
    private String interventionMessage;

    // B3: Agent 2 output persistence
    @Column(name = "clinical_analysis", columnDefinition = "TEXT")
    private String clinicalAnalysis;

    @Column(name = "critical_flags", columnDefinition = "JSON")
    private String criticalFlags;

    // H1: Agent 5 → Agent 6 followup timing (days until follow-up, from LLM recommendation)
    @Column(name = "followup_days")
    @Builder.Default
    private Integer followupDays = 3;

    // #2: clinical analysis pipeline status
    @Column(name = "analysis_status", length = 20)
    private String analysisStatus;

    // #4: why the appointment was cancelled
    @Column(name = "cancel_reason", length = 30)
    private String cancelReason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
