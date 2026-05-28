package com.healthcare.portal.followup;

import com.healthcare.portal.appointment.Appointment;
import com.healthcare.portal.appointment.AppointmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Agent 6 — Post-Visit Follow-up Scheduler.
 *
 * Runs daily at 9 AM. Finds DISCHARGED appointments whose follow-up is due
 * (discharged_at + followup_days <= now) and haven't received a follow-up email yet.
 * followup_days is set by Agent 5 during discharge planning (7d cardiac, 14d mental health, 30d chronic).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FollowupScheduler {

    private final AppointmentRepository appointmentRepository;
    private final FollowupService       followupService;

    @Nullable
    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    // H4: 10 PM daily sweep — mark BOOKED appointments whose date has passed as NO_SHOW.
    @Scheduled(cron = "0 0 22 * * ?")
    @Transactional
    public void markNoShows() {
        if (!acquireLock("lock:noshow-daily", Duration.ofMinutes(5))) return;
        try {
            int count = appointmentRepository.markPastBookedAsNoShow(LocalDate.now());
            log.info("[NoShowSweep] Marked {} appointments as NO_SHOW", count);
        } finally {
            releaseLock("lock:noshow-daily");
        }
    }

    // #4: 5-min intra-day sweep — marks BOOKED appointments whose slot time passed (with 15-min grace).
    @Scheduled(cron = "0 */5 * * * ?")
    @Transactional
    public void markRecentNoShows() {
        if (!acquireLock("lock:noshow-intraday", Duration.ofMinutes(4))) return;
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusMinutes(15);
            int count = appointmentRepository.markPastStartAsNoShow(cutoff);
            if (count > 0) log.info("[NoShowSweep] Marked {} as NO_SHOW (5-min intra-day sweep)", count);
        } finally {
            releaseLock("lock:noshow-intraday");
        }
    }

    // Parallel execution — each appointment gets its own CompletableFuture with a 30s timeout.
    @Scheduled(cron = "0 0 9 * * ?")   // 9 AM daily
    public void sendFollowupEmails() {
        LocalDateTime now = LocalDateTime.now();
        List<Appointment> pending = appointmentRepository.findPendingFollowups(now);
        log.info("[Agent6] Follow-up scheduler: {} appointments pending", pending.size());
        if (pending.isEmpty()) return;

        List<CompletableFuture<Void>> futures = pending.stream()
                .map(appt -> CompletableFuture
                        .runAsync(() -> followupService.processFollowupInternal(appt, now))
                        .orTimeout(30, TimeUnit.SECONDS)
                        .exceptionally(ex -> {
                            log.error("[Agent6] Timed out or failed for appointment {}: {}",
                                    appt.getId(), ex.getMessage());
                            return null;
                        }))
                .toList();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        log.info("[Agent6] Follow-up batch complete");
    }

    private boolean acquireLock(String key, Duration ttl) {
        if (redisTemplate == null) return true;
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(key, "1", ttl);
        if (!Boolean.TRUE.equals(acquired)) {
            log.debug("[Scheduler] Lock {} already held by another instance — skipping", key);
            return false;
        }
        return true;
    }

    private void releaseLock(String key) {
        if (redisTemplate != null) redisTemplate.delete(key);
    }
}
