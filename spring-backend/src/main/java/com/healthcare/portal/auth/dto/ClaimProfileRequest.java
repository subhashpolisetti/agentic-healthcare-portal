package com.healthcare.portal.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ClaimProfileRequest {

    @NotBlank @Email
    private String email;

    @NotBlank
    @Size(min = 10, max = 10, message = "NPI must be exactly 10 digits")
    private String npi;
}
