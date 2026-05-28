package com.healthcare.portal.auth;

import com.healthcare.portal.auth.dto.AuthResponse;
import com.healthcare.portal.auth.dto.ClaimProfileRequest;
import com.healthcare.portal.auth.dto.LoginRequest;
import com.healthcare.portal.auth.dto.SignupRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/claim")
    public ResponseEntity<AuthResponse> claimProfile(@Valid @RequestBody ClaimProfileRequest request) {
        return ResponseEntity.ok(authService.claimProfile(request));
    }
}
