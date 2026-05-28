package com.healthcare.portal.appointment;

import com.healthcare.portal.appointment.dto.AppointmentRequest;
import com.healthcare.portal.appointment.dto.AppointmentResponse;
import com.healthcare.portal.appointment.dto.DischargeRequest;
import com.healthcare.portal.followup.FollowupService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/appointments")
@RequiredArgsConstructor
@Validated
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final FollowupService    followupService;

    @PostMapping
    public ResponseEntity<AppointmentResponse> book(
            Authentication auth,
            @Valid @RequestBody AppointmentRequest request) {
        return ResponseEntity.ok(appointmentService.book(auth.getName(), request));
    }

    // Identity comes from JWT — never from a client-supplied parameter
    @GetMapping("/me")
    public ResponseEntity<List<AppointmentResponse>> myAppointments(Authentication auth) {
        return ResponseEntity.ok(appointmentService.getPatientAppointments(auth.getName()));
    }

    @GetMapping("/doctor")
    public ResponseEntity<List<AppointmentResponse>> doctorSchedule(Authentication auth) {
        return ResponseEntity.ok(appointmentService.getDoctorAppointments(auth.getName()));
    }

    @GetMapping("/doctor/admitted")
    public ResponseEntity<List<AppointmentResponse>> admitted(Authentication auth) {
        return ResponseEntity.ok(appointmentService.getDoctorAppointmentsByStatus(auth.getName(), AppointmentStatus.ADMITTED));
    }

    @GetMapping("/doctor/discharged")
    public ResponseEntity<List<AppointmentResponse>> discharged(
            Authentication auth,
            @RequestParam(value = "from_date", required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(value = "to_date", required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {

        if (fromDate != null && toDate != null) {
            return ResponseEntity.ok(appointmentService.getDoctorDischargedInRange(auth.getName(), fromDate, toDate));
        }
        return ResponseEntity.ok(appointmentService.getDoctorAppointmentsByStatus(auth.getName(), AppointmentStatus.DISCHARGED));
    }

    @GetMapping("/doctor/noshow")
    public ResponseEntity<List<AppointmentResponse>> noShow(Authentication auth) {
        return ResponseEntity.ok(appointmentService.getNoShowAppointments(auth.getName()));
    }

    // #4: patient self-cancellation with 2h cutoff + reason
    @DeleteMapping("/{id}")
    public ResponseEntity<AppointmentResponse> cancel(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(appointmentService.cancel(id, auth.getName(), reason));
    }

    // #4: doctor-initiated cancellation (no 2h cutoff, accepts BOOKED or ADMITTED)
    @PostMapping("/{id}/doctor-cancel")
    public ResponseEntity<AppointmentResponse> doctorCancel(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(appointmentService.cancelByDoctor(id, auth.getName(), reason));
    }

    // #9: At Risk tab — upcoming BOOKED appointments with high noshow risk
    @GetMapping("/doctor/at-risk")
    public ResponseEntity<List<AppointmentResponse>> atRisk(Authentication auth) {
        return ResponseEntity.ok(appointmentService.getAtRiskAppointments(auth.getName()));
    }

    // Agent 6: follow-up funnel stats for the discharged tab (last 30 days)
    @GetMapping("/doctor/followup-stats")
    public ResponseEntity<Map<String, Long>> followupStats(Authentication auth) {
        return ResponseEntity.ok(followupService.getStats(auth.getName()));
    }

    // Agent 6: doctor manually sends follow-up for a specific discharged patient
    @PostMapping("/{id}/send-followup")
    public ResponseEntity<Void> sendFollowup(Authentication auth, @PathVariable Long id) {
        followupService.sendFollowupForAppointment(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    // #2: called by AI service after clinical analysis — internal only (security ignore list)
    @PatchMapping("/{id}/analysis-status")
    public ResponseEntity<AppointmentResponse> updateAnalysisStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        return ResponseEntity.ok(appointmentService.updateAnalysisStatus(id, status));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AppointmentResponse> updateStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        return ResponseEntity.ok(appointmentService.updateStatus(id, status));
    }

    // Doctor confirms discharge after reviewing AI-generated notes
    @PostMapping("/{id}/discharge")
    public ResponseEntity<AppointmentResponse> discharge(
            @PathVariable Long id,
            @Valid @RequestBody DischargeRequest request) {
        return ResponseEntity.ok(appointmentService.discharge(id, request));
    }

    // Called by AI service after no-show prediction — internal only (security ignore list)
    @PatchMapping("/{id}/noshow-risk")
    public ResponseEntity<AppointmentResponse> updateNoshowRisk(
            @PathVariable Long id,
            @RequestParam @DecimalMin("0.0") @DecimalMax("1.0") Double risk,
            @RequestParam(required = false) String message) {
        return ResponseEntity.ok(appointmentService.updateNoshowRisk(id, risk, message));
    }

    // Called by AI service after Agent 2 clinical analysis — internal only (security ignore list)
    @PatchMapping("/{id}/clinical-analysis")
    public ResponseEntity<AppointmentResponse> updateClinicalAnalysis(
            @PathVariable Long id,
            @RequestParam String analysis,
            @RequestParam(required = false) String criticalFlags) {
        return ResponseEntity.ok(appointmentService.updateClinicalAnalysis(id, analysis, criticalFlags));
    }

    // Called by AI service after Agent 5 discharge — internal only (security ignore list)
    @PatchMapping("/{id}/followup-days")
    public ResponseEntity<AppointmentResponse> updateFollowupDays(
            @PathVariable Long id,
            @RequestParam Integer days) {
        return ResponseEntity.ok(appointmentService.updateFollowupDays(id, days));
    }
}
