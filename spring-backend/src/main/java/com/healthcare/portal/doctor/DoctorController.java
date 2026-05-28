package com.healthcare.portal.doctor;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService doctorService;

    @GetMapping("/{npi}/slots")
    public ResponseEntity<Map<String, List<String>>> getSlots(
            @PathVariable String npi,
            @RequestParam("appointment_date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate appointmentDate) {

        List<String> slots = doctorService.getAvailableSlots(npi, appointmentDate);
        return ResponseEntity.ok(Map.of("available_slots", slots));
    }
}
