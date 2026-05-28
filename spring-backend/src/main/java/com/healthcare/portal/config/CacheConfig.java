package com.healthcare.portal.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

@EnableCaching
@Configuration
public class CacheConfig {

    // ── In-memory fallback (default when REDIS_ENABLED=false) ─────────────────
    // No Redis connection needed — works locally with zero setup.
    // Slots are still cached in-memory within the same JVM instance.

    @Bean
    @ConditionalOnProperty(name = "app.redis.enabled", havingValue = "false", matchIfMissing = true)
    public CacheManager inMemoryCacheManager() {
        return new ConcurrentMapCacheManager("slots", "ai-recommend", "doctor-lookup");
    }

    // ── Redis cache (Upstash — activated via REDIS_ENABLED=true) ──────────────
    // Distributed cache with TTL. Required for multi-instance production deployments.

    @Bean
    @ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true")
    public RedisConnectionFactory redisConnectionFactory(
            @Value("${app.redis.url}") String redisUrl) throws Exception {

        URI uri = URI.create(redisUrl);
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(
                uri.getHost(), uri.getPort());

        // Extract password from URI (rediss://default:<token>@host:port)
        String userInfo = uri.getUserInfo();
        if (userInfo != null && userInfo.contains(":")) {
            config.setPassword(userInfo.substring(userInfo.indexOf(':') + 1));
        }

        LettuceClientConfiguration clientConfig = uri.getScheme().equals("rediss")
                ? LettuceClientConfiguration.builder().useSsl().build()
                : LettuceClientConfiguration.defaultConfiguration();

        return new LettuceConnectionFactory(config, clientConfig);
    }

    @Bean
    @ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true")
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }

    @Bean
    @ConditionalOnProperty(name = "app.redis.enabled", havingValue = "true")
    public CacheManager redisCacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericJackson2JsonRedisSerializer()));

        Map<String, RedisCacheConfiguration> perCache = Map.of(
                "slots",         base.entryTtl(Duration.ofSeconds(30)),
                "ai-recommend",  base.entryTtl(Duration.ofMinutes(5)),
                "doctor-lookup", base.entryTtl(Duration.ofMinutes(10))
        );

        return RedisCacheManager.builder(factory)
                .cacheDefaults(base.entryTtl(Duration.ofSeconds(30)))
                .withInitialCacheConfigurations(perCache)
                .build();
    }
}
