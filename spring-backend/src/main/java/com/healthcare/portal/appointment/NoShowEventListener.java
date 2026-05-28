package com.healthcare.portal.appointment;

import com.healthcare.portal.proxy.AiServiceProxy;
import com.healthcare.portal.pubsub.AppointmentEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class NoShowEventListener {

    private final AiServiceProxy aiServiceProxy;
    private final AppointmentEventPublisher pubSubPublisher;
    private final AppointmentRepository appointmentRepository;

    /**
     * Fires AFTER the booking transaction commits — appointment is guaranteed
     * to be visible in TiDB before the AI service calls back to save the risk.
     *
     * B2: idempotency — re-fetches from DB and checks noshow_triggered_at before triggering.
     * If Pub/Sub re-delivers the event, the check prevents duplicate intervention emails.
     *
     * H5: past_noshow_rate — computed from real appointment history instead of hardcoded 0.0.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAppointmentBooked(AppointmentBookedEvent event) {
        Long apptId = event.getAppointment().getId();
        if (apptId == null) {
            log.warn("No-show trigger: appointment ID is null, skipping");
            return;
        }

        // B2: atomic idempotency — single UPDATE WHERE noshow_triggered_at IS NULL.
        // Returns 0 if already triggered; no read-check-write race possible.
        int marked = appointmentRepository.markNoshowTriggered(apptId, LocalDateTime.now());
        if (marked == 0) {
            log.info("No-show already triggered for appointment {}, skipping re-delivery", apptId);
            return;
        }

        // Re-fetch for the rest of the payload (lazy fields need a fresh managed entity)
        Appointment appt = appointmentRepository.findById(apptId).orElse(null);
        if (appt == null) {
            log.warn("No-show trigger: appointment {} not found after marking", apptId);
            return;
        }

        // H5: compute real past_noshow_rate from appointment history
        long total   = appointmentRepository.countByPatientId(appt.getPatient().getId());
        long noShows = appointmentRepository.countNoShowsByPatientId(appt.getPatient().getId());
        double pastNoshowRate = total > 1 ? (double) noShows / (total - 1) : 0.0; // exclude current booking

        var doctor = event.getDoctor();
        Map<String, Object> payload = Map.of(
                "appointment_id",   apptId,
                "patient_email",    appt.getPatient().getEmail(),
                "patient_name",     appt.getPatient().getFullName() != null ? appt.getPatient().getFullName() : "",
                "doctor_name",      doctor.getDoctorName(),
                "appointment_date", appt.getAppointmentDate().toString(),
                "slot_start_time",  appt.getSlotStartTime().toString(),
                "specialty",        doctor.getSpeciality(),
                "past_noshow_rate", pastNoshowRate
        );

        log.info("Triggering no-show prediction for appointment {} (past_noshow_rate={:.2f})",
                apptId, pastNoshowRate);

        try {
            if (pubSubPublisher.isEnabled()) {
                pubSubPublisher.publishAppointmentBooked(payload);
                log.info("Published appointment.booked to Pub/Sub for id={}", apptId);
            } else {
                aiServiceProxy.predictNoShowRisk(payload);
            }
        } catch (Exception e) {
            log.error("No-show trigger failed for appointment {}: {}", apptId, e.getMessage());
            if (pubSubPublisher.isEnabled()) {
                try {
                    aiServiceProxy.predictNoShowRisk(payload);
                    log.info("Fallback to direct HTTP succeeded for appointment {}", apptId);
                } catch (Exception fallbackEx) {
                    log.error("Fallback also failed for appointment {}: {}", apptId, fallbackEx.getMessage());
                }
            }
        }
    }
}
