package com.healthcare.portal.auth;

import com.healthcare.portal.auth.dto.AuthResponse;
import com.healthcare.portal.auth.dto.ClaimProfileRequest;
import com.healthcare.portal.auth.dto.LoginRequest;
import com.healthcare.portal.auth.dto.SignupRequest;
import com.healthcare.portal.doctor.Doctor;
import com.healthcare.portal.doctor.DoctorRepository;
import com.healthcare.portal.user.AppUser;
import com.healthcare.portal.user.Role;
import com.healthcare.portal.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        Role role;
        try {
            role = Role.valueOf(request.getRole().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role. Must be 'patient' or 'doctor'");
        }
        if (role == Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role. Must be 'patient' or 'doctor'");
        }

        if (role == Role.DOCTOR && (request.getNpi() == null || request.getNpi().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "NPI is required for doctor accounts");
        }

        AppUser user = userRepository.save(AppUser.builder()
                .email(request.getEmail())
                .fullName(request.getFullName())
                .role(role)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .build());

        // Link doctor auth account to NPPES profile via NPI
        if (role == Role.DOCTOR) {
            Doctor doctor = doctorRepository.findByNpi(request.getNpi())
                    .orElseGet(() -> Doctor.builder()
                            .npi(request.getNpi())
                            .doctorName(request.getFullName())
                            .speciality("General Practice")
                            .build());
            doctor.setEmail(user.getEmail());   // keeps existing appointment queries working
            doctor.setAppUserId(user.getId());  // new FK link
            doctorRepository.save(doctor);
        }

        String token = jwtUtil.generateToken(user.getEmail(), role.name());
        return new AuthResponse(token, user.getEmail(), user.getFullName(), role.name().toLowerCase());
    }

    public AuthResponse login(LoginRequest request) {
        AppUser user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name());
        return new AuthResponse(token, user.getEmail(), user.getFullName(), user.getRole().name().toLowerCase());
    }

    /**
     * Doctor claims their existing NPPES profile by NPI.
     * Links their app_users email to the doctors table record.
     */
    @Transactional
    public AuthResponse claimProfile(ClaimProfileRequest request) {
        AppUser user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        if (user.getRole() != Role.DOCTOR) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only doctors can claim a profile");
        }

        doctorRepository.findByNpi(request.getNpi())
                .map(doctor -> {
                    doctor.setEmail(user.getEmail());
                    return doctorRepository.save(doctor);
                })
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No NPPES doctor found with NPI: " + request.getNpi()));

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name());
        return new AuthResponse(token, user.getEmail(), user.getFullName(), user.getRole().name().toLowerCase());
    }
}
