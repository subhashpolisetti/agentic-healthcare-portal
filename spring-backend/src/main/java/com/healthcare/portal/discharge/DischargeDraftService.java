package com.healthcare.portal.discharge;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DischargeDraftService {

    private final DischargeDraftRepository repository;

    @Transactional
    public DischargeDraft createDraft(Long appointmentId, String content, String generatedBy) {
        // If a draft already exists, create a new version on top
        int nextVersion = repository.findTopByAppointmentIdOrderByVersionDesc(appointmentId)
                .map(d -> d.getVersion() + 1)
                .orElse(1);

        DischargeDraft draft = DischargeDraft.builder()
                .appointmentId(appointmentId)
                .version(nextVersion)
                .content(content)
                .status(DischargeDraftStatus.AI_GENERATED)
                .etag(UUID.randomUUID().toString())
                .updatedBy(generatedBy)
                .build();

        log.info("[DischargeDraft] Created version {} for appointment {}", nextVersion, appointmentId);
        return repository.save(draft);
    }

    @Transactional
    public DischargeDraft updateDraft(Long appointmentId, String content, String etag, String updatedBy) {
        DischargeDraft latest = repository.findTopByAppointmentIdOrderByVersionDesc(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No draft found for appointment " + appointmentId));

        // Optimistic concurrency: reject if etag doesn't match (another user already saved)
        if (!latest.getEtag().equals(etag)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Draft was modified by another user. Reload and retry.");
        }

        latest.setVersion(latest.getVersion() + 1);
        latest.setContent(content);
        latest.setStatus(DischargeDraftStatus.DOCTOR_EDITING);
        latest.setEtag(UUID.randomUUID().toString());
        latest.setUpdatedBy(updatedBy);

        log.info("[DischargeDraft] Autosaved version {} for appointment {}", latest.getVersion(), appointmentId);
        return repository.save(latest);
    }

    @Transactional
    public DischargeDraft approveDraft(Long appointmentId, String etag) {
        DischargeDraft latest = repository.findTopByAppointmentIdOrderByVersionDesc(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No draft found for appointment " + appointmentId));

        if (!latest.getEtag().equals(etag)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Draft was modified since you last loaded it. Reload and retry.");
        }

        latest.setStatus(DischargeDraftStatus.APPROVED);
        log.info("[DischargeDraft] Approved draft for appointment {}", appointmentId);
        return repository.save(latest);
    }

    public Optional<DischargeDraft> getLatest(Long appointmentId) {
        return repository.findTopByAppointmentIdOrderByVersionDesc(appointmentId);
    }
}
