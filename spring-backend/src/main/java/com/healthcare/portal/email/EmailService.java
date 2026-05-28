package com.healthcare.portal.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Async
    public void sendBookingConfirmation(String toEmail, String patientName,
                                        String doctorName, LocalDate date, LocalTime time) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject("Appointment Confirmed — AI HealthCare Portal");
            msg.setText(String.format("""
                    Hi %s,

                    Your appointment has been confirmed.

                    Doctor:  %s
                    Date:    %s
                    Time:    %s

                    Please arrive 10 minutes early.

                    — AI HealthCare Portal
                    """,
                    patientName,
                    doctorName,
                    date.format(DateTimeFormatter.ofPattern("MMMM d, yyyy")),
                    time.format(DateTimeFormatter.ofPattern("h:mm a"))));
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send booking confirmation to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendFollowupEmail(String toEmail, String patientName,
                                  String doctorName, String followupMessage) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject("Following Up On Your Recent Visit — AI HealthCare Portal");
            msg.setText(String.format("""
                    Hi %s,

                    %s

                    Your care team at AI HealthCare Portal is here if you need anything.
                    Reply to this email or call us to schedule a follow-up with %s.

                    — AI HealthCare Portal
                    """,
                    patientName, followupMessage, doctorName));
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send follow-up email to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendCancellationConfirmation(String toEmail, String patientName,
                                             String doctorName, LocalDate date, LocalTime time) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject("Appointment Cancelled — AI HealthCare Portal");
            msg.setText(String.format("""
                    Hi %s,

                    Your appointment has been cancelled as requested.

                    Doctor:  %s
                    Date:    %s
                    Time:    %s

                    To rebook, visit our portal any time.

                    — AI HealthCare Portal
                    """,
                    patientName,
                    doctorName,
                    date.format(DateTimeFormatter.ofPattern("MMMM d, yyyy")),
                    time.format(DateTimeFormatter.ofPattern("h:mm a"))));
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send cancellation confirmation to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendNoShowIntervention(String toEmail, String patientName,
                                       String doctorName, String date,
                                       String time, String riskLevel,
                                       String interventionMessage) {
        try {
            boolean isHigh = "high".equalsIgnoreCase(riskLevel);
            // Use LLM-generated message if available, otherwise fall back to template
            String body = (interventionMessage != null && !interventionMessage.isBlank())
                    ? interventionMessage
                    : (isHigh
                        ? "We noticed your appointment is at risk of being missed. Please confirm or contact us to reschedule."
                        : "Just a friendly reminder about your upcoming appointment.");

            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject(isHigh
                    ? "Action Required — Appointment Reminder"
                    : "Friendly Reminder — Upcoming Appointment");
            msg.setText(String.format("""
                    Hi %s,

                    %s

                    Doctor:  %s
                    Date:    %s
                    Time:    %s

                    — AI HealthCare Portal
                    """,
                    patientName, body, doctorName, date, time));
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send no-show intervention to {}: {}", toEmail, e.getMessage());
        }
    }
}
