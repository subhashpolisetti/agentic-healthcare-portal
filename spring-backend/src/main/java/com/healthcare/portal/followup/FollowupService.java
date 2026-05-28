package com.healthcare.portal.followup;

import com.healthcare.portal.appointment.Appointment;
import com.healthcare.portal.appointment.AppointmentRepository;
import com.healthcare.portal.appointment.AppointmentStatus;
import com.healthcare.portal.email.EmailService;
import com.healthcare.portal.proxy.AiServiceProxy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class FollowupService {

    private final AppointmentRepository appointmentRepository;
    private final AiServiceProxy        aiServiceProxy;
    private final EmailService          emailService;

    /**
     * Core logic shared by the daily scheduler and the manual trigger endpoint.
     * Returns true on success, false on failure (does not throw — scheduler can continue the batch).
     */
    public boolean processFollowupInternal(Appointment appt, LocalDateTime now) {
        try {
            long daysSince = java.time.temporal.ChronoUnit.DAYS.between(
                    appt.getDischargedAt().toLocalDate(), now.toLocalDate());

            Map<String, Object> payload = Map.of(
                    "appointment_id",       appt.getId(),
                    "patient_name",         appt.getPatient().getFullName(),
                    "doctor_name",          appt.getDoctor().getDoctorName(),
                    "specialty",            appt.getDoctor().getSpeciality(),
                    "discharge_summary",    appt.getDischargeSummary() != null
                                                ? appt.getDischargeSummary() : "",
                    "days_since_discharge", daysSince
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> result = (Map<String, Object>)
                    aiServiceProxy.forward(HttpMethod.POST, "/agents/followup/generate", payload, null)
                                  .getBody();

            if (result != null && result.get("followup_message") != null) {
                emailService.sendFollowupEmail(
                        appt.getPatient().getEmail(),
                        appt.getPatient().getFullName(),
                        appt.getDoctor().getDoctorName(),
                        result.get("followup_message").toString()
                );
                appt.setFollowupSentAt(LocalDateTime.now());
                appointmentRepository.save(appt);
                log.info("[Agent6] Follow-up sent for appointment {}", appt.getId());
                return true;
            }
            log.warn("[Agent6] AI service returned empty message for appointment {}", appt.getId());
            return false;
        } catch (Exception e) {
            log.error("[Agent6] Failed to send follow-up for appointment {}: {}", appt.getId(), e.getMessage());
            return false;
        }
    }

    /**
     * Manual trigger — called from the doctor UI "Send follow-up now" button.
     * Validates doctor owns the appointment and throws HTTP errors on failure.
     */
    @Transactional
    public void sendFollowupForAppointment(Long appointmentId, String doctorEmail) {
        Appointment appt = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));

        if (!appt.getDoctor().getEmail().equals(doctorEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your patient");
        }
        if (appt.getStatus() != AppointmentStatus.DISCHARGED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Patient not yet discharged");
        }
        if (appt.getFollowupSentAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Follow-up already sent");
        }
        if (appt.getDischargeSummary() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No discharge summary — complete discharge workflow first");
        }

        boolean ok = processFollowupInternal(appt, LocalDateTime.now());
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Follow-up generation failed — AI service may be unavailable");
        }
    }

    /**
     * Stats for the discharged tab funnel over the last 30 days.
     */
    public Map<String, Long> getStats(String doctorEmail) {
        LocalDateTime from30d = LocalDateTime.now().minusDays(30);
        return Map.of(
                "discharged_30d",    appointmentRepository.countDischargedSince(doctorEmail, from30d),
                "followup_sent",     appointmentRepository.countFollowupSentSince(doctorEmail, from30d),
                "followup_pending",  appointmentRepository.countFollowupPending(doctorEmail)
        );
    }
}
