package dev.wmaduro.wsecurity.admin.shared;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Configuração do console (04 §5, RNF-ARQ-05). Os endpoints do IdP são explícitos: {@code idp.issuer} é o endereço visto
 * pelo navegador (e o {@code iss} esperado) e {@code idp.internal-uri} é o endereço usado pelo BFF (DEC-08).
 */
@Validated
@ConfigurationProperties("wsecurity.admin")
public record AdminProperties(
        @Valid @NotNull Idp idp,
        @Valid @NotNull Authz authz,
        @Valid @NotNull Client client,
        @Valid @NotNull Client serviceClient,
        @NotNull URI publicUri,
        @Valid @NotNull Session session,
        @Valid @NotNull Proxy proxy) {

    public record Idp(@NotNull URI issuer, @NotNull URI internalUri) {}

    public record Authz(@NotNull URI uri) {}

    /** Credenciais de um cliente do IdP. O segredo nunca aparece no {@code toString()} (RNF-SEG-06). */
    public record Client(String id, String secret) {

        public boolean isConfigured() {
            return id != null && !id.isBlank() && secret != null && !secret.isBlank();
        }

        @Override
        public String toString() {
            return "Client[id=" + id + ", secret=" + (secret == null ? "null" : "***") + "]";
        }
    }

    public record Session(
            @NotNull Duration idleTimeout, @NotNull Duration maxAge) {}

    public record Proxy(
            @NotNull Duration connectTimeout, @NotNull Duration readTimeout) {}
}
