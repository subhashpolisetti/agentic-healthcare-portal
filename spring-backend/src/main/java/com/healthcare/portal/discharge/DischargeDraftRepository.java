package com.healthcare.portal.discharge;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DischargeDraftRepository extends JpaRepository<DischargeDraft, Long> {

    Optional<DischargeDraft> findTopByAppointmentIdOrderByVersionDesc(Long appointmentId);

    Optional<DischargeDraft> findByAppointmentIdAndVersion(Long appointmentId, Integer version);
}
