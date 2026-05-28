package com.healthcare.portal.proxy;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Slf4j
@Service
public class AiServiceProxy {

    private final RestTemplate restTemplate;
    private final String aiServiceUrl;

    public AiServiceProxy(@Value("${app.ai-service.url}") String aiServiceUrl) {
        this.restTemplate = new RestTemplate();
        this.aiServiceUrl = aiServiceUrl;
    }

    @CircuitBreaker(name = "ai-service")
    public void predictNoShowRisk(Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        try {
            restTemplate.postForEntity(aiServiceUrl + "/agents/noshow/predict", entity, Object.class);
        } catch (Exception e) {
            log.error("No-show prediction failed for appointment {}: {}",
                    payload.get("appointment_id"), e.getMessage());
        }
    }

    @CircuitBreaker(name = "ai-service", fallbackMethod = "fallback")
    @Retry(name = "ai-service")
    public ResponseEntity<Object> forward(HttpMethod method, String path,
                                          Object body, String queryString) {
        String url = aiServiceUrl + path;
        if (queryString != null && !queryString.isBlank()) {
            url = url + "?" + queryString;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Object> entity = new HttpEntity<>(body, headers);

        log.debug("Forwarding {} {} to AI service", method, url);

        return restTemplate.exchange(url, method, entity, Object.class);
    }

    // Circuit breaker fallback — AI service is down
    public ResponseEntity<Object> fallback(HttpMethod method, String path,
                                           Object body, String queryString, Throwable t) {
        log.error("AI service unavailable for {} {}: {}", method, path, t.getMessage());
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "AI service is temporarily unavailable. Please try again shortly.");
    }
}
