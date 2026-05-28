package com.healthcare.portal.doctor;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "doctors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 10, unique = true)
    private String npi;

    @Column(name = "doctor_name", nullable = false)
    private String doctorName;

    @Column(nullable = false)
    private String speciality;

    @Column(unique = true)
    private String email;

    private String city;
    private String state;
    private String zip;
    private String phone;

    // FK to app_users.id — set when the doctor self-registers via NPI
    @Column(name = "app_user_id")
    private Long appUserId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
