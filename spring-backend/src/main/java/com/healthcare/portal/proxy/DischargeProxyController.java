package com.healthcare.portal.proxy;

import com.healthcare.portal.appointment.Appointment;
import com.healthcare.portal.appointment.AppointmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Intercepts POST /agents/discharge/generate before the wildcard AiProxyController.
 * Enriches the body with clinical_analysis from DB (Agent 2 output persisted via B3 fix)
 * so Agent 5 SOAP notes have the full clinical context (H6 fix).
 *
 * Spring MVC's most-specific-match rule ensures this explicit path always wins over
 * AiProxyController's /agents/** wildcard.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class DischargeProxyController {

    private final AiServiceProxy aiServiceProxy;
    private final AppointmentRepository appointmentRepository;

    @PostMapping("/agents/discharge/generate")
    public ResponseEntity<Object> generateDischargeNotes(
            @RequestBody Map<String, Object> body) {

        Map<String, Object> enriched = new HashMap<>(body);

        // H6: inject Agent 2's persisted clinical_analysis into the payload
        Object apptIdRaw = body.get("appointment_id");
        if (apptIdRaw instanceof Number apptIdNum) {
            appointmentRepository.findById(apptIdNum.longValue())
                    .map(Appointment::getClinicalAnalysis)
                    .filter(ca -> ca != null && !ca.isBlank())
                    .ifPresent(ca -> {
                        enriched.put("clinical_analysis", ca);
                        log.info("[H6] Injected clinical_analysis ({} chars) into Agent 5 for appt {}",
                                ca.length(), apptIdNum);
                    });
        }

        return aiServiceProxy.forward(HttpMethod.POST, "/agents/discharge/generate", enriched, null);
    }
}
