package com.healthcare.portal.appointment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.healthcare.portal.appointment.Appointment;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
public class AppointmentResponse {

    // Controlled via noshow.risk.* in application.yml — applied by RiskThresholds on startup
    public static volatile double HIGH_THRESHOLD   = 0.65;
    public static volatile double MEDIUM_THRESHOLD = 0.35;

    @JsonProperty("appointment_id")
    private Long appointmentId;

    @JsonProperty("doctor_name")
    private String doctorName;

    private String speciality;

    @JsonProperty("patient_name")
    private String patientName;

    @JsonProperty("patient_email")
    private String patientEmail;

    @JsonProperty("appointment_date")
    private LocalDate appointmentDate;

    @JsonProperty("slot_start_time")
    private LocalTime slotStartTime;

    private String status;

    @JsonProperty("discharged_at")
    private LocalDateTime dischargedAt;

    @JsonProperty("noshow_risk")
    private BigDecimal noshowRisk;

    @JsonProperty("chief_complaint")
    private String chiefComplaint;

    @JsonProperty("soap_notes")
    private String soapNotes;

    @JsonProperty("discharge_summary")
    private String dischargeSummary;

    @JsonProperty("followup_sent_at")
    private LocalDateTime followupSentAt;

    // L4: centralize risk_level computation in DTO; frontend should read this instead of computing
    @JsonProperty("risk_level")
    private String riskLevel;

    // B3: Agent 2 persisted output
    @JsonProperty("clinical_analysis")
    private String clinicalAnalysis;

    @JsonProperty("critical_flags")
    private String criticalFlags;

    // H1: followup timing from Agent 5
    @JsonProperty("followup_days")
    private Integer followupDays;

    // #2: clinical analysis pipeline state
    @JsonProperty("analysis_status")
    private String analysisStatus;

    // #4: cancellation reason
    @JsonProperty("cancel_reason")
    private String cancelReason;

    // Agent 03: LLM-generated reminder message (non-null = reminder was sent)
    @JsonProperty("intervention_message")
    private String interventionMessage;

    public static AppointmentResponse from(Appointment a) {
        AppointmentResponse r = new AppointmentResponse();
        r.setAppointmentId(a.getId());
        r.setDoctorName(a.getDoctor().getDoctorName());
        r.setSpeciality(a.getDoctor().getSpeciality());
        r.setPatientName(a.getPatient().getFullName());
        r.setPatientEmail(a.getPatient().getEmail());
        r.setAppointmentDate(a.getAppointmentDate());
        r.setSlotStartTime(a.getSlotStartTime());
        r.setStatus(a.getStatus().name().toLowerCase());
        r.setDischargedAt(a.getDischargedAt());
        r.setNoshowRisk(a.getNoshowRisk());
        r.setChiefComplaint(a.getChiefComplaint());
        r.setSoapNotes(a.getSoapNotes());
        r.setDischargeSummary(a.getDischargeSummary());
        r.setFollowupSentAt(a.getFollowupSentAt());
        r.setClinicalAnalysis(a.getClinicalAnalysis());
        r.setCriticalFlags(a.getCriticalFlags());
        r.setFollowupDays(a.getFollowupDays());
        // L4: compute risk_level from decimal so frontend doesn't need to
        if (a.getNoshowRisk() != null) {
            double risk = a.getNoshowRisk().doubleValue();
            r.setRiskLevel(risk > HIGH_THRESHOLD ? "high" : risk > MEDIUM_THRESHOLD ? "medium" : "low");
        }
        r.setAnalysisStatus(a.getAnalysisStatus());
        r.setCancelReason(a.getCancelReason());
        r.setInterventionMessage(a.getInterventionMessage());
        return r;
    }
}
