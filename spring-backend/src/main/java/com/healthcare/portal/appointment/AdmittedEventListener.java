package com.healthcare.portal.appointment;

import com.healthcare.portal.monitoring.MonitoringSessionService;
import com.healthcare.portal.proxy.AiServiceProxy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

/**
 * B4: Fan-out on ADMITTED event.
 * When doctor admits a patient, this listener automatically triggers Agent 2
 * (clinical decision support) so the analysis is ready by the time the doctor
 * opens the Clinical Analysis tab — no manual "Run Analysis" click required.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AdmittedEventListener {

    private final AiServiceProxy aiServiceProxy;
    private final MonitoringSessionService monitoringSessionService;
    private final AppointmentRepository appointmentRepository;

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPatientAdmitted(AppointmentAdmittedEvent event) {
        Appointment appt   = event.getAppointment();
        var patient = event.getPatient();
        var doctor  = event.getDoctor();
        Long apptId = appt.getId();

        log.info("[B4] Patient admitted — starting monitoring + Agent 2 for appointment {}", apptId);

        // #2: mark analysis IN_PROGRESS before calling AI (frontend shows pulsing badge)
        appointmentRepository.findById(apptId).ifPresent(a -> {
            a.setAnalysisStatus("IN_PROGRESS");
            appointmentRepository.save(a);
        });

        // #1/#10: start monitoring session (tracked in DB, survives AI service restarts)
        monitoringSessionService.startSession(apptId);

        try {
            Map<String, Object> body = Map.of(
                    "appointment_id",  apptId,
                    "patient_name",    patient.getFullName() != null ? patient.getFullName() : "",
                    "specialty",       doctor.getSpeciality(),
                    "chief_complaint", appt.getChiefComplaint() != null ? appt.getChiefComplaint() : ""
            );
            aiServiceProxy.forward(HttpMethod.POST, "/agents/clinical/analyze", body, null);
            log.info("[B4] Agent 2 triggered successfully for appointment {}", apptId);
        } catch (Exception e) {
            // Non-fatal: mark FAILED so frontend shows red badge; doctor can re-run manually
            appointmentRepository.findById(apptId).ifPresent(a -> {
                a.setAnalysisStatus("FAILED");
                appointmentRepository.save(a);
            });
            log.warn("[B4] Agent 2 auto-trigger failed for appointment {}: {}", apptId, e.getMessage());
        }
    }
}
