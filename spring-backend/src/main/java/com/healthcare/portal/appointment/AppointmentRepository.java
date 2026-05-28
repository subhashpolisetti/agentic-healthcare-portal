package com.healthcare.portal.appointment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    @Query("SELECT a FROM Appointment a JOIN FETCH a.doctor JOIN FETCH a.patient " +
           "WHERE a.patient.email = :email ORDER BY a.appointmentDate DESC")
    List<Appointment> findByPatientEmail(@Param("email") String email);

    @Query("SELECT a FROM Appointment a JOIN FETCH a.doctor JOIN FETCH a.patient " +
           "WHERE a.doctor.email = :doctorEmail ORDER BY a.appointmentDate ASC, a.slotStartTime ASC")
    List<Appointment> findByDoctorEmail(@Param("doctorEmail") String doctorEmail);

    @Query("SELECT a FROM Appointment a JOIN FETCH a.doctor JOIN FETCH a.patient " +
           "WHERE a.doctor.email = :doctorEmail AND a.status = :status " +
           "ORDER BY a.appointmentDate ASC, a.slotStartTime ASC")
    List<Appointment> findByDoctorEmailAndStatus(
            @Param("doctorEmail") String doctorEmail,
            @Param("status") AppointmentStatus status);

    @Query("SELECT a FROM Appointment a JOIN FETCH a.doctor JOIN FETCH a.patient " +
           "WHERE a.doctor.email = :doctorEmail AND a.status = :status " +
           "AND a.dischargedAt BETWEEN :from AND :to " +
           "ORDER BY a.dischargedAt DESC")
    List<Appointment> findDischargedInRange(
            @Param("doctorEmail") String doctorEmail,
            @Param("status") AppointmentStatus status,
            @Param("from") java.time.LocalDateTime from,
            @Param("to") java.time.LocalDateTime to);

    @Query("SELECT a.slotStartTime FROM Appointment a " +
           "WHERE a.doctor.id = :doctorId AND a.appointmentDate = :date " +
           "AND a.status IN (com.healthcare.portal.appointment.AppointmentStatus.BOOKED, " +
           "                 com.healthcare.portal.appointment.AppointmentStatus.ADMITTED)")
    List<LocalTime> findBookedSlots(@Param("doctorId") Long doctorId, @Param("date") LocalDate date);

    // No-show: BOOKED appointments where date is before today
    @Query("SELECT a FROM Appointment a JOIN FETCH a.doctor JOIN FETCH a.patient " +
           "WHERE a.doctor.email = :doctorEmail " +
           "AND a.status = com.healthcare.portal.appointment.AppointmentStatus.BOOKED " +
           "AND a.appointmentDate < :today " +
           "ORDER BY a.appointmentDate DESC")
    List<Appointment> findNoShows(@Param("doctorEmail") String doctorEmail,
                                  @Param("today") LocalDate today);

    // H5: past no-show rate — total appointments for patient (excludes current booking)
    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.id = :patientId")
    long countByPatientId(@Param("patientId") Long patientId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.id = :patientId " +
           "AND a.status = com.healthcare.portal.appointment.AppointmentStatus.NO_SHOW")
    long countNoShowsByPatientId(@Param("patientId") Long patientId);

    // H4: Daily sweep — mark past BOOKED appointments (date < today) as NO_SHOW.
    // Runs at 10 PM daily so same-day appointments aren't marked during business hours.
    @Modifying
    @Query("UPDATE Appointment a SET a.status = com.healthcare.portal.appointment.AppointmentStatus.NO_SHOW " +
           "WHERE a.status = com.healthcare.portal.appointment.AppointmentStatus.BOOKED " +
           "AND a.appointmentDate < :today")
    int markPastBookedAsNoShow(@Param("today") LocalDate today);

    // H4: No Show tab — shows appointments already marked NO_SHOW by the daily sweep.
    @Query("SELECT a FROM Appointment a JOIN FETCH a.doctor JOIN FETCH a.patient " +
           "WHERE a.doctor.email = :doctorEmail " +
           "AND a.status = com.healthcare.portal.appointment.AppointmentStatus.NO_SHOW " +
           "ORDER BY a.appointmentDate DESC")
    List<Appointment> findNoShowsByDoctorEmail(@Param("doctorEmail") String doctorEmail);

    // #9: At Risk tab — upcoming BOOKED appointments with high noshow_risk
    @Query("SELECT a FROM Appointment a JOIN FETCH a.doctor JOIN FETCH a.patient " +
           "WHERE a.doctor.email = :email AND a.status = com.healthcare.portal.appointment.AppointmentStatus.BOOKED " +
           "AND a.appointmentDate >= :today AND a.noshowRisk > :threshold " +
           "ORDER BY a.appointmentDate ASC, a.slotStartTime ASC")
    List<Appointment> findHighRiskUpcoming(@Param("email") String email,
                                            @Param("today") LocalDate today,
                                            @Param("threshold") java.math.BigDecimal threshold);

    // #4: 5-min NO_SHOW sweep — marks BOOKED appointments whose slot+date is before cutoff
    @Modifying
    @Query(value = "UPDATE appointments SET status = 'NO_SHOW' " +
                   "WHERE status = 'BOOKED' " +
                   "AND TIMESTAMP(appointment_date, slot_start_time) < :cutoff",
           nativeQuery = true)
    int markPastStartAsNoShow(@Param("cutoff") LocalDateTime cutoff);

    // Atomic idempotency: sets noshow_triggered_at only if still null (concurrent re-delivery safe).
    // Returns 1 on first trigger, 0 if already triggered — caller checks the return value.
    @Modifying
    @Query("UPDATE Appointment a SET a.noshowTriggeredAt = :now " +
           "WHERE a.id = :id AND a.noshowTriggeredAt IS NULL")
    int markNoshowTriggered(@Param("id") Long id, @Param("now") LocalDateTime now);

    // Agent 6 stats — count DISCHARGED appointments in the last N days for this doctor
    @Query("SELECT COUNT(a) FROM Appointment a " +
           "WHERE a.doctor.email = :email " +
           "AND a.status = com.healthcare.portal.appointment.AppointmentStatus.DISCHARGED " +
           "AND a.dischargedAt >= :from")
    long countDischargedSince(@Param("email") String email, @Param("from") LocalDateTime from);

    // Agent 6 stats — count discharged appointments that have had a follow-up sent
    @Query("SELECT COUNT(a) FROM Appointment a " +
           "WHERE a.doctor.email = :email " +
           "AND a.status = com.healthcare.portal.appointment.AppointmentStatus.DISCHARGED " +
           "AND a.followupSentAt IS NOT NULL AND a.dischargedAt >= :from")
    long countFollowupSentSince(@Param("email") String email, @Param("from") LocalDateTime from);

    // Agent 6 stats — count discharged appointments still awaiting follow-up (have summary, not sent)
    @Query("SELECT COUNT(a) FROM Appointment a " +
           "WHERE a.doctor.email = :email " +
           "AND a.status = com.healthcare.portal.appointment.AppointmentStatus.DISCHARGED " +
           "AND a.followupSentAt IS NULL AND a.dischargeSummary IS NOT NULL")
    long countFollowupPending(@Param("email") String email);

    // H1: Agent 6 — DISCHARGED appointments due for follow-up based on Agent 5's recommendation.
    // Uses native SQL (DATE_ADD) so each appointment's own followup_days drives the timing.
    // COALESCE(followup_days, 3) falls back to 3-day default for appointments without Agent 5 data.
    @Query(value = "SELECT * FROM appointments " +
                   "WHERE status = 'DISCHARGED' " +
                   "AND followup_sent_at IS NULL " +
                   "AND discharge_summary IS NOT NULL " +
                   "AND discharged_at IS NOT NULL " +
                   "AND DATE_ADD(discharged_at, INTERVAL COALESCE(followup_days, 3) DAY) <= :now",
           nativeQuery = true)
    List<Appointment> findPendingFollowups(@Param("now") java.time.LocalDateTime now);
}
