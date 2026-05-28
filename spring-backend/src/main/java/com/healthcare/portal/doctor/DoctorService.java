package com.healthcare.portal.doctor;

import com.healthcare.portal.appointment.AppointmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;

    private static final LocalTime FIRST_SLOT = LocalTime.of(9, 0);
    private static final LocalTime LAST_SLOT  = LocalTime.of(16, 30);

    @Cacheable(value = "slots", key = "#npi + ':' + #date")
    public List<String> getAvailableSlots(String npi, LocalDate date) {
        // If doctor not in TiDB yet (NPPES doctor from ChromaDB), return all slots —
        // no appointments booked yet for a new doctor so all times are open.
        var doctorOpt = doctorRepository.findByNpi(npi);
        if (doctorOpt.isEmpty()) {
            return generateAllSlots().stream().map(LocalTime::toString).collect(Collectors.toList());
        }

        List<LocalTime> booked = appointmentRepository.findBookedSlots(doctorOpt.get().getId(), date);
        return generateAllSlots().stream()
                .filter(slot -> !booked.contains(slot))
                .map(LocalTime::toString)
                .collect(Collectors.toList());
    }

    /**
     * Find doctor by NPI. If not in TiDB (NPPES doctor from ChromaDB),
     * auto-create a minimal record so the appointment can be saved.
     */
    public Doctor findByNpi(String npi) {
        return doctorRepository.findByNpi(npi)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Doctor with NPI " + npi + " not found."));
    }

    /**
     * Find or create doctor by NPI. Used during booking — if the doctor came from
     * ChromaDB (NPPES) but isn't in TiDB yet, persist a minimal record.
     */
    @SuppressWarnings("null")
    public Doctor findOrCreate(String npi, String name, String speciality,
                               String city, String state, String zip, String phone) {
        var existing = doctorRepository.findByNpi(npi);
        if (existing.isPresent()) return existing.get();
        Doctor d = Doctor.builder()
                .npi(npi)
                .doctorName(name != null ? name : "Dr. " + npi)
                .speciality(speciality != null ? speciality : "General Practice")
                .city(city)
                .state(state)
                .zip(zip)
                .phone(phone)
                .build();
        return doctorRepository.save(d);
    }

    private List<LocalTime> generateAllSlots() {
        List<LocalTime> slots = new java.util.ArrayList<>();
        LocalTime slot = FIRST_SLOT;
        while (!slot.isAfter(LAST_SLOT)) {
            slots.add(slot);
            slot = slot.plusMinutes(30);
        }
        return slots;
    }
}
