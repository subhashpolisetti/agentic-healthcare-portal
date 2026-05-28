package com.healthcare.portal.admin;

import com.healthcare.portal.appointment.AppointmentRepository;
import com.healthcare.portal.doctor.Doctor;
import com.healthcare.portal.doctor.DoctorRepository;
import com.healthcare.portal.proxy.AiServiceProxy;
import com.healthcare.portal.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AiServiceProxy aiServiceProxy;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;

    // ── ChromaDB lookup (proxy to AI service) ─────────────────────────────────

    @GetMapping("/doctors/nppes/lookup")
    public ResponseEntity<Object> npiLookup(HttpServletRequest request) {
        return aiServiceProxy.forward(HttpMethod.GET, "/doctors/nppes/lookup", null, request.getQueryString());
    }

    @GetMapping("/doctors/nppes/search")
    public ResponseEntity<Object> searchDoctors(HttpServletRequest request) {
        return aiServiceProxy.forward(HttpMethod.GET, "/doctors/nppes/search", null, request.getQueryString());
    }

    // ── Import doctor from ChromaDB result into TiDB ──────────────────────────

    @PostMapping("/doctors/import")
    public ResponseEntity<Map<String, Object>> importDoctor(@RequestBody Map<String, String> req) {
        String npi = req.get("npi");
        if (npi == null || npi.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "npi is required"));
        }

        Doctor doctor = doctorRepository.findByNpi(npi)
                .orElseGet(() -> Doctor.builder()
                        .npi(npi)
                        .doctorName(req.getOrDefault("doctor_name", "Unknown"))
                        .speciality(req.getOrDefault("specialty", "General Practice"))
                        .city(req.get("city"))
                        .state(req.get("state"))
                        .zip(req.get("zip"))
                        .phone(req.get("phone"))
                        .build());

        // Update fields from ChromaDB data even if record already exists
        if (req.containsKey("doctor_name") && req.get("doctor_name") != null)
            doctor.setDoctorName(req.get("doctor_name"));
        if (req.containsKey("specialty") && req.get("specialty") != null)
            doctor.setSpeciality(req.get("specialty"));
        if (req.containsKey("city"))   doctor.setCity(req.get("city"));
        if (req.containsKey("state"))  doctor.setState(req.get("state"));
        if (req.containsKey("zip"))    doctor.setZip(req.get("zip"));
        if (req.containsKey("phone"))  doctor.setPhone(req.get("phone"));

        Doctor saved = doctorRepository.save(doctor);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", saved.getId());
        response.put("npi", saved.getNpi());
        response.put("doctor_name", saved.getDoctorName());
        response.put("message", "Doctor imported to portal");
        return ResponseEntity.ok(response);
    }

    // ── Portal management ─────────────────────────────────────────────────────

    @GetMapping("/doctors")
    public ResponseEntity<List<Map<String, Object>>> listDoctors() {
        List<Map<String, Object>> doctors = doctorRepository.findAll().stream()
                .map(d -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", d.getId());
                    m.put("npi", d.getNpi());
                    m.put("doctor_name", d.getDoctorName());
                    m.put("speciality", d.getSpeciality());
                    m.put("email", d.getEmail());
                    m.put("city", d.getCity());
                    m.put("state", d.getState());
                    m.put("linked", d.getAppUserId() != null);
                    m.put("created_at", d.getCreatedAt());
                    return m;
                })
                .toList();
        return ResponseEntity.ok(doctors);
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> listUsers() {
        List<Map<String, Object>> users = userRepository.findAll().stream()
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("email", u.getEmail());
                    m.put("full_name", u.getFullName());
                    m.put("role", u.getRole().name().toLowerCase());
                    m.put("created_at", u.getCreatedAt());
                    return m;
                })
                .toList();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("total_doctors", doctorRepository.count());
        s.put("total_users", userRepository.count());
        s.put("total_appointments", appointmentRepository.count());
        return ResponseEntity.ok(s);
    }
}
