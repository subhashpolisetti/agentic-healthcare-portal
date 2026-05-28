package com.healthcare.portal.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SignupRequest {

    @NotBlank @Email
    private String email;

    @NotBlank @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    @NotBlank
    @JsonProperty("full_name")
    private String fullName;

    @NotBlank
    private String role; // "patient" or "doctor"

    // Required when role=doctor — used to link auth account to NPPES doctor profile
    @JsonProperty("npi")
    @Size(min = 10, max = 10, message = "NPI must be exactly 10 digits")
    private String npi;
}
