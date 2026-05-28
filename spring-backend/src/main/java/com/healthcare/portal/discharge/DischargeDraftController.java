package com.healthcare.portal.discharge;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/appointments/{appointmentId}/discharge-draft")
@RequiredArgsConstructor
public class DischargeDraftController {

    private final DischargeDraftService draftService;

    @GetMapping("/latest")
    public ResponseEntity<DischargeDraft> getLatest(@PathVariable Long appointmentId) {
        return draftService.getLatest(appointmentId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<DischargeDraft> create(
            @PathVariable Long appointmentId,
            @RequestBody Map<String, String> body) {
        DischargeDraft draft = draftService.createDraft(
                appointmentId,
                body.get("content"),
                body.getOrDefault("updated_by", "ai-service"));
        return ResponseEntity.ok(draft);
    }

    @PutMapping("/{version}")
    public ResponseEntity<DischargeDraft> update(
            @PathVariable Long appointmentId,
            @PathVariable Integer version,
            @RequestBody Map<String, String> body) {
        DischargeDraft draft = draftService.updateDraft(
                appointmentId,
                body.get("content"),
                body.get("etag"),
                body.getOrDefault("updated_by", "doctor"));
        return ResponseEntity.ok(draft);
    }

    @PostMapping("/{version}/approve")
    public ResponseEntity<DischargeDraft> approve(
            @PathVariable Long appointmentId,
            @PathVariable Integer version,
            @RequestBody Map<String, String> body) {
        DischargeDraft draft = draftService.approveDraft(appointmentId, body.get("etag"));
        return ResponseEntity.ok(draft);
    }
}
