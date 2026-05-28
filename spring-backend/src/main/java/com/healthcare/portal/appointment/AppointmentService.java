package com.healthcare.portal.appointment;

import com.healthcare.portal.appointment.dto.AppointmentRequest;
import com.healthcare.portal.appointment.dto.AppointmentResponse;
import com.healthcare.portal.appointment.dto.DischargeRequest;
import com.healthcare.portal.doctor.Doctor;
import com.healthcare.portal.doctor.DoctorService;
import com.healthcare.portal.email.EmailService;
import com.healthcare.portal.user.AppUser;
import com.healthcare.portal.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")   // Spring Data JPA save/findById always return non-null; Lombok checker false positives
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final DoctorService doctorService;
    private final EmailService emailService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    @CacheEvict(value = "slots", key = "#req.getNpi() + ':' + #req.getAppointmentDate()")
    public AppointmentResponse book(String patientEmail, AppointmentRequest req) {
        AppUser patient = userRepository.findByEmail(patientEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));

        // Find or auto-create doctor — NPPES doctors exist in ChromaDB but may not be in TiDB yet
        Doctor doctor = doctorService.findOrCreate(
                req.getNpi(), req.getDoctorName(), req.getSpeciality(),
                req.getCity(), req.getState(), req.getZip(), req.getPhone());

        // Reject past appointments
        LocalDateTime slotDateTime = LocalDateTime.of(req.getAppointmentDate(), req.getSlotStartTime());
        if (slotDateTime.isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot book an appointment in the past");
        }

        // Check slot is still available before saving
        List<LocalTime> booked = appointmentRepository.findBookedSlots(doctor.getId(), req.getAppointmentDate());
        if (booked.contains(req.getSlotStartTime())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Slot " + req.getSlotStartTime() + " is already booked");
        }

        Appointment appointment = appointmentRepository.save(Appointment.builder()
                .doctor(doctor)
                .patient(patient)
                .appointmentDate(req.getAppointmentDate())
                .slotStartTime(req.getSlotStartTime())
                .chiefComplaint(req.getChiefComplaint())
                .status(AppointmentStatus.BOOKED)
                .build());

        emailService.sendBookingConfirmation(patient.getEmail(), patient.getFullName(),
                doctor.getDoctorName(), req.getAppointmentDate(), req.getSlotStartTime());

        // Publish event — NoShowEventListener fires AFTER this transaction commits
        eventPublisher.publishEvent(new AppointmentBookedEvent(appointment, patient, doctor));

        return AppointmentResponse.from(appointment);
    }

    @Transactional
    public AppointmentResponse updateNoshowRisk(Long id, Double risk, String interventionMessage) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        appt.setNoshowRisk(BigDecimal.valueOf(risk));
        if (interventionMessage != null && !interventionMessage.isBlank()) {
            appt.setInterventionMessage(interventionMessage); // L2: persist audit trail
        }
        return AppointmentResponse.from(appointmentRepository.save(appt));
    }

    @Transactional
    public AppointmentResponse updateClinicalAnalysis(Long id, String analysis, String criticalFlagsJson) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        appt.setClinicalAnalysis(analysis);
        appt.setCriticalFlags(criticalFlagsJson);
        return AppointmentResponse.from(appointmentRepository.save(appt));
    }

    @Transactional
    public AppointmentResponse updateFollowupDays(Long id, Integer days) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        appt.setFollowupDays(days);
        return AppointmentResponse.from(appointmentRepository.save(appt));
    }

    public List<AppointmentResponse> getPatientAppointments(String email) {
        return appointmentRepository.findByPatientEmail(email)
                .stream().map(AppointmentResponse::from).toList();
    }

    public List<AppointmentResponse> getDoctorAppointments(String doctorEmail) {
        return appointmentRepository.findByDoctorEmailAndStatus(doctorEmail, AppointmentStatus.BOOKED)
                .stream().map(AppointmentResponse::from).toList();
    }

    public List<AppointmentResponse> getDoctorAppointmentsByStatus(String doctorEmail, AppointmentStatus status) {
        return appointmentRepository.findByDoctorEmailAndStatus(doctorEmail, status)
                .stream().map(AppointmentResponse::from).toList();
    }

    public List<AppointmentResponse> getDoctorDischargedInRange(String doctorEmail, LocalDate from, LocalDate to) {
        return appointmentRepository.findDischargedInRange(
                        doctorEmail,
                        AppointmentStatus.DISCHARGED,
                        from.atStartOfDay(),
                        to.plusDays(1).atStartOfDay())
                .stream().map(AppointmentResponse::from).toList();
    }

    public List<AppointmentResponse> getNoShowAppointments(String doctorEmail) {
        return appointmentRepository.findNoShowsByDoctorEmail(doctorEmail)
                .stream().map(AppointmentResponse::from).toList();
    }

    // #4: patient self-cancellation — only BOOKED, must be ≥2h before slot
    @Transactional
    public AppointmentResponse cancel(Long id, String patientEmail, String reason) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));

        if (!appt.getPatient().getEmail().equalsIgnoreCase(patientEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own appointments");
        }
        if (appt.getStatus() != AppointmentStatus.BOOKED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only BOOKED appointments can be cancelled (current status: " + appt.getStatus() + ")");
        }

        LocalDateTime slotDateTime = LocalDateTime.of(appt.getAppointmentDate(), appt.getSlotStartTime());
        if (LocalDateTime.now().isAfter(slotDateTime.minusHours(2))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cancellations must be made at least 2 hours before the appointment");
        }

        appt.setStatus(AppointmentStatus.CANCELLED);
        appt.setCancelReason(reason != null && !reason.isBlank() ? reason : "PATIENT_REQUEST");
        Appointment saved = appointmentRepository.save(appt);

        emailService.sendCancellationConfirmation(
                appt.getPatient().getEmail(),
                appt.getPatient().getFullName(),
                appt.getDoctor().getDoctorName(),
                appt.getAppointmentDate(),
                appt.getSlotStartTime());

        log.info("Appointment {} cancelled by patient {} (reason: {})", id, patientEmail, appt.getCancelReason());
        return AppointmentResponse.from(saved);
    }

    // #4: doctor-initiated cancellation — no 2h cutoff, accepts BOOKED or ADMITTED
    @Transactional
    public AppointmentResponse cancelByDoctor(Long id, String doctorEmail, String reason) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));

        if (!appt.getDoctor().getEmail().equalsIgnoreCase(doctorEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own patients' appointments");
        }
        if (appt.getStatus() != AppointmentStatus.BOOKED && appt.getStatus() != AppointmentStatus.ADMITTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only BOOKED or ADMITTED appointments can be cancelled (current status: " + appt.getStatus() + ")");
        }

        appt.setStatus(AppointmentStatus.CANCELLED);
        appt.setCancelReason(reason != null && !reason.isBlank() ? reason : "PROVIDER_UNAVAILABLE");
        Appointment saved = appointmentRepository.save(appt);

        emailService.sendCancellationConfirmation(
                appt.getPatient().getEmail(),
                appt.getPatient().getFullName(),
                appt.getDoctor().getDoctorName(),
                appt.getAppointmentDate(),
                appt.getSlotStartTime());

        log.info("Appointment {} cancelled by doctor {} (reason: {})", id, doctorEmail, appt.getCancelReason());
        return AppointmentResponse.from(saved);
    }

    // #9: At Risk tab — upcoming BOOKED appointments with high noshow risk
    public List<AppointmentResponse> getAtRiskAppointments(String doctorEmail) {
        java.math.BigDecimal threshold = java.math.BigDecimal.valueOf(
                com.healthcare.portal.appointment.dto.AppointmentResponse.HIGH_THRESHOLD);
        return appointmentRepository.findHighRiskUpcoming(doctorEmail, LocalDate.now(), threshold)
                .stream().map(AppointmentResponse::from).toList();
    }

    // #2: called by AI service after clinical analysis completes (IN_PROGRESS → READY/FAILED)
    @Transactional
    public AppointmentResponse updateAnalysisStatus(Long id, String status) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        appt.setAnalysisStatus(status);
        log.info("[Clinical] Appointment {} analysis_status → {}", id, status);
        return AppointmentResponse.from(appointmentRepository.save(appt));
    }

    // Called by doctor after reviewing AI-generated notes — saves notes + sets DISCHARGED
    @Transactional
    public AppointmentResponse discharge(Long id, DischargeRequest req) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));

        appt.setSoapNotes(req.getSoapNotes());
        appt.setDischargeSummary(req.getDischargeSummary());
        appt.setStatus(AppointmentStatus.DISCHARGED);
        appt.setDischargedAt(LocalDateTime.now());

        log.info("Appointment {} discharged with AI-generated notes", id);
        return AppointmentResponse.from(appointmentRepository.save(appt));
    }

    @Transactional
    public AppointmentResponse updateStatus(Long id, String status) {
        Appointment appt = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));

        AppointmentStatus newStatus;
        try {
            newStatus = AppointmentStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid status. Must be: booked, admitted, no_show");
        }
        // H2: DISCHARGED must go through discharge() to save SOAP notes + summary.
        // Bypassing via updateStatus would leave discharge_summary null, breaking Agent 6.
        if (newStatus == AppointmentStatus.DISCHARGED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Use POST /appointments/{id}/discharge to discharge with notes");
        }
        appt.setStatus(newStatus);

        Appointment saved = appointmentRepository.save(appt);

        // B4: fan-out on ADMITTED — triggers Agent 2 (clinical analysis) automatically
        if (newStatus == AppointmentStatus.ADMITTED) {
            eventPublisher.publishEvent(new AppointmentAdmittedEvent(saved, saved.getPatient(), saved.getDoctor()));
        }

        return AppointmentResponse.from(saved);
    }
}
