package com.healthcare.portal.config;

import com.healthcare.portal.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Method;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class ApplicationConfig implements AsyncConfigurer {

    private final UserRepository userRepository;

    @Bean
    public UserDetailsService userDetailsService() {
        return email -> userRepository.findByEmail(email)
                .map(u -> User.builder()
                        .username(u.getEmail())
                        .password(u.getPasswordHash())
                        .roles(u.getRole().name())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Logs all uncaught exceptions from @Async methods — without this Spring silently drops them.
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (Throwable ex, Method method, Object... params) ->
                log.error("[Async] Uncaught exception in {}.{}(): {}",
                        method.getDeclaringClass().getSimpleName(), method.getName(), ex.getMessage(), ex);
    }
}
