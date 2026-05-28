package com.healthcare.portal.doctor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {
    Optional<Doctor> findByDoctorNameIgnoreCase(String doctorName);
    Optional<Doctor> findByEmail(String email);
    Optional<Doctor> findByNpi(String npi);
}
