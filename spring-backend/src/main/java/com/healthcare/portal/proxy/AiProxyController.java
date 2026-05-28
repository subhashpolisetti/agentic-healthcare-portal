package com.healthcare.portal.proxy;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Wildcard proxy — forwards all AI service routes to the FastAPI AI service.
 * Covers: /agents/**, /match/**, /cases/**, /clinical/**, /location/**
 *
 * Adding a new AI endpoint requires NO changes here — just add it to the AI service.
 * Spring Boot's most-specific-match rule ensures native controllers (/auth, /appointments,
 * /doctors, /health, /internal) always win over this catch-all.
 */
@RestController
@RequiredArgsConstructor
public class AiProxyController {

    private final AiServiceProxy aiServiceProxy;

    private static final String API_PREFIX = "/api/v1";

    @RequestMapping(value = {
        "/agents/**",
        "/match/**",
        "/cases/**",
        "/clinical/**",
        "/location/**",
    })
    public ResponseEntity<Object> proxyToAiService(
            HttpMethod method,
            HttpServletRequest request,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        String uri = request.getRequestURI();
        // Strip the Spring Boot context prefix so the AI service gets the raw path
        String path = uri.contains(API_PREFIX)
                ? uri.substring(uri.indexOf(API_PREFIX) + API_PREFIX.length())
                : uri;

        return aiServiceProxy.forward(method, path, body, request.getQueryString());
    }
}
