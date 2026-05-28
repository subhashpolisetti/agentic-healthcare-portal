package com.healthcare.portal.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * M6: Catches DB unique-constraint violations (e.g. duplicate slot booking under concurrent load)
 * and returns 409 Conflict instead of 500 Internal Server Error.
 *
 * The AppointmentService.book() checks availability before saving (optimistic lock),
 * but under concurrent requests two threads can both pass the check. The
 * @UniqueConstraint on (doctor_id, appointment_date, slot_start_time) is the safety net.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDuplicateSlot(DataIntegrityViolationException ex) {
        log.warn("Constraint violation (likely duplicate slot): {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(Map.of("error", "This slot was just booked by another patient. Please choose a different time."));
    }

    // Handles all ResponseStatusException (401 wrong password, 404, 409, etc.)
    // Without this, Spring logs them as ERROR — they're expected business errors, not server faults.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException ex) {
        String message = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        log.debug("ResponseStatusException {}: {}", ex.getStatusCode(), message);
        return ResponseEntity
                .status(ex.getStatusCode())
                .body(Map.of("error", message));
    }
}
