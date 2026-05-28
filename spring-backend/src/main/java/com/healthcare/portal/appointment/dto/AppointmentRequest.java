package com.healthcare.portal.appointment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class AppointmentRequest {

    // Optional — used only for display; doctor identity resolved via NPI from TiDB
    @JsonProperty("doctor_name")
    private String doctorName;

    @NotBlank
    @Size(min = 10, max = 10, message = "NPI must be exactly 10 digits")
    private String npi;

    @NotBlank
    private String speciality;

    // email removed — patient identity comes from JWT (Authentication.getName())

    @NotNull
    @JsonProperty("appointment_date")
    private LocalDate appointmentDate;

    @NotNull
    @JsonProperty("slot_start_time")
    private LocalTime slotStartTime;

    // Doctor location fields — used to auto-create doctor in TiDB if NPPES-only
    private String city;
    private String state;
    private String zip;
    private String phone;

    // Patient's enriched symptoms + intake Q&A — stored for doctor review
    @JsonProperty("chief_complaint")
    private String chiefComplaint;
}
