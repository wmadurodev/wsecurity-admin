package dev.wmaduro.wsecurity.admin.shared;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class ProductionConfigurationCheckTest {

    @Test
    void passesWhenRequiredValuesArePresent() {
        AdminProperties properties = properties("http://localhost:9000", "http://localhost:9200", "console", "s3cr3t");

        assertThat(ProductionConfigurationCheck.missingVariables(properties)).isEmpty();
    }

    @Test
    void failsListingOnlyTheMissingVariableNames() {
        AdminProperties properties = properties("", "", "", "s3cr3t");

        assertThatThrownBy(() -> new ProductionConfigurationCheck(properties).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("WSECURITY_ADMIN_IDP_ISSUER")
                .hasMessageContaining("WSECURITY_ADMIN_PUBLIC_URI")
                .hasMessageContaining("WSECURITY_ADMIN_CLIENT_ID")
                .hasMessageNotContaining("WSECURITY_ADMIN_CLIENT_SECRET")
                .hasMessageNotContaining("s3cr3t");
    }

    @Test
    void clientToStringMasksTheSecret() {
        assertThat(new AdminProperties.Client("console", "s3cr3t").toString()).doesNotContain("s3cr3t");
    }

    private static AdminProperties properties(String issuer, String publicUri, String clientId, String secret) {
        return new AdminProperties(
                new AdminProperties.Idp(URI.create(issuer), URI.create(issuer)),
                new AdminProperties.Authz(URI.create("http://localhost:9100")),
                new AdminProperties.Client(clientId, secret),
                new AdminProperties.Client(null, null),
                URI.create(publicUri),
                new AdminProperties.Session(Duration.ofMinutes(30), Duration.ofHours(12)),
                new AdminProperties.Proxy(Duration.ofSeconds(2), Duration.ofSeconds(10)));
    }
}
