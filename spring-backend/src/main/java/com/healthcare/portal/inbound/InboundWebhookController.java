package com.healthcare.portal.inbound;

import com.healthcare.portal.proxy.AiServiceProxy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/internal/inbound")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class InboundWebhookController {

    private final InboundMessageRepository inboundMessageRepository;
    private final AiServiceProxy aiServiceProxy;

    @PostMapping("/sms")
    public ResponseEntity<Void> receiveSms(@RequestBody Map<String, Object> params) {
        String from = (String) params.getOrDefault("From", "");
        String body = (String) params.getOrDefault("Body", "");
        if (from.isBlank() || body.isBlank()) {
            log.warn("[Inbound] Rejected SMS webhook — blank From or Body");
            return ResponseEntity.badRequest().build();
        }
        String truncatedBody = body.length() > 4000 ? body.substring(0, 4000) : body;
        InboundMessage msg = inboundMessageRepository.save(InboundMessage.builder()
                .fromChannel("SMS")
                .fromAddress(from)
                .body(truncatedBody)
                .build());
        classifyAsync(msg.getId(), from, truncatedBody);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/email")
    public ResponseEntity<Void> receiveEmail(@RequestBody Map<String, Object> params) {
        String from = (String) params.getOrDefault("from", "");
        String text = (String) params.getOrDefault("text", "");
        if (from.isBlank() || text.isBlank()) {
            log.warn("[Inbound] Rejected email webhook — blank from or text");
            return ResponseEntity.badRequest().build();
        }
        String truncatedText = text.length() > 4000 ? text.substring(0, 4000) : text;
        InboundMessage msg = inboundMessageRepository.save(InboundMessage.builder()
                .fromChannel("EMAIL")
                .fromAddress(from)
                .body(truncatedText)
                .build());
        classifyAsync(msg.getId(), from, truncatedText);
        return ResponseEntity.ok().build();
    }

    private void classifyAsync(Long messageId, String fromAddress, String body) {
        try {
            Map<String, Object> payload = Map.of(
                    "message_id", messageId,
                    "from_address", fromAddress,
                    "body", body
            );
            aiServiceProxy.forward(HttpMethod.POST, "/agents/inbound/classify", payload, null);
        } catch (Exception e) {
            log.warn("[Inbound] AI classification failed for message {}: {}", messageId, e.getMessage());
        }
    }
}
