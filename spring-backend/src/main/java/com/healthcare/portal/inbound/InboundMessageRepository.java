package com.healthcare.portal.inbound;

import org.springframework.data.jpa.repository.JpaRepository;

public interface InboundMessageRepository extends JpaRepository<InboundMessage, Long> {
}
