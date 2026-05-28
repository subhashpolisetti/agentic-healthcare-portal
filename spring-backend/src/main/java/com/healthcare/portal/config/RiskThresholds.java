package com.healthcare.portal.config;

import com.healthcare.portal.appointment.dto.AppointmentResponse;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "noshow.risk")
@Getter
@Setter
public class RiskThresholds {

    private double highThreshold   = 0.65;
    private double mediumThreshold = 0.35;

    @PostConstruct
    void applyToResponse() {
        AppointmentResponse.HIGH_THRESHOLD   = highThreshold;
        AppointmentResponse.MEDIUM_THRESHOLD = mediumThreshold;
    }
}
