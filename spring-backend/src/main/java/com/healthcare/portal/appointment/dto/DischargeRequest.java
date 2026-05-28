package com.healthcare.portal.appointment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DischargeRequest {

    @NotBlank
    @Size(max = 500)
    @JsonProperty("chief_complaint")
    private String chiefComplaint;

    // Doctor may edit AI-generated notes before confirming — nullable on first generate call
    @Size(max = 8000)
    @JsonProperty("soap_notes")
    private String soapNotes;

    @Size(max = 4000)
    @JsonProperty("discharge_summary")
    private String dischargeSummary;
}
