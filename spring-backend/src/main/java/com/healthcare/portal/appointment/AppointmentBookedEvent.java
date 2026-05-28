package com.healthcare.portal.appointment;

import com.healthcare.portal.doctor.Doctor;
import com.healthcare.portal.user.AppUser;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class AppointmentBookedEvent {
    private final Appointment appointment;
    private final AppUser patient;
    private final Doctor doctor;
}
