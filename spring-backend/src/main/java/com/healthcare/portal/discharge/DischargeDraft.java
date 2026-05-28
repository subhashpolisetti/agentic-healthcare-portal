package com.healthcare.portal.discharge;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "discharge_draft",
    uniqueConstraints = @UniqueConstraint(columnNames = {"appointment_id", "version"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DischargeDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // JPA optimistic locking — prevents concurrent overwrites without relying on etag timing alone.
    // Requires: ALTER TABLE discharge_draft ADD COLUMN jpa_version BIGINT NOT NULL DEFAULT 0;
    @Version
    @Column(name = "jpa_version", nullable = false)
    @Builder.Default
    private Long jpaVersion = 0L;

    @Column(name = "appointment_id", nullable = false)
    private Long appointmentId;

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private DischargeDraftStatus status = DischargeDraftStatus.AI_GENERATED;

    @Column(nullable = false, length = 64)
    private String etag;

    @Column(name = "updated_by")
    private String updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
