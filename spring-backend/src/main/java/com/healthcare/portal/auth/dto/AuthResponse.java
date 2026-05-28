package com.healthcare.portal.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String email;

    @JsonProperty("full_name")
    private String fullName;

    private String role;
}
