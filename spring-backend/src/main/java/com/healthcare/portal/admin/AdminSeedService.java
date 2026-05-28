package com.healthcare.portal.admin;

import com.healthcare.portal.user.AppUser;
import com.healthcare.portal.user.Role;
import com.healthcare.portal.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminSeedService implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email:}")
    private String adminEmail;

    @Value("${app.admin.password:}")
    private String adminPassword;

    @Value("${app.admin.name:System Admin}")
    private String adminName;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (adminEmail.isBlank() || adminPassword.isBlank()) {
            log.info("[AdminSeed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed");
            return;
        }
        if (userRepository.existsByEmail(adminEmail)) {
            log.debug("[AdminSeed] Admin {} already exists — skipping", adminEmail);
            return;
        }
        userRepository.save(AppUser.builder()
                .email(adminEmail)
                .fullName(adminName)
                .role(Role.ADMIN)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .build());
        log.info("[AdminSeed] Admin account created: {}", adminEmail);
    }
}
