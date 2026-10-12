package dev.wmaduro.wsecurity.admin.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class SecurityConfigurationTest {

    @Test
    void cspAllowsFormsOnlyToTheConsoleAndTheIdp() {
        assertThat(SecurityConfiguration.contentSecurityPolicy(properties("https://idp.exemplo.com/", "console")))
                .endsWith("form-action 'self' https://idp.exemplo.com")
                .doesNotContain("unsafe-inline")
                .doesNotContain("unsafe-eval");
    }

    @Test
    void postLogoutGoesToThePublicAddressOutsideDev() {
        AdminProperties properties = properties("https://idp.exemplo.com", "console");

        assertThat(SecurityConfiguration.postLogoutRedirectUri(properties, false))
                .isEqualTo("https://admin.exemplo.com/");
        assertThat(SecurityConfiguration.postLogoutRedirectUri(properties, true))
                .isEqualTo("{baseUrl}/");
    }

    @Test
    void clientIsRequired() {
        assertThatThrownBy(() -> new OAuthClientConfiguration()
                        .clientRegistrationRepository(properties("https://idp.exemplo.com", "")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("WSECURITY_ADMIN_CLIENT_ID");
    }

    @Test
    void registrationsUseBrowserAndInternalAddresses() {
        var registration = OAuthClientConfiguration.registration(
                properties("https://idp.exemplo.com", "console"), "wsecurity", java.util.Set.of("openid"));

        assertThat(registration.getProviderDetails().getAuthorizationUri())
                .isEqualTo("https://idp.exemplo.com/oauth2/authorize");
        assertThat(registration.getProviderDetails().getTokenUri())
                .isEqualTo("http://authentication:9000/oauth2/token");
        assertThat(registration.getProviderDetails().getJwkSetUri())
                .isEqualTo("http://authentication:9000/oauth2/jwks");
        assertThat(registration.getProviderDetails().getIssuerUri()).isEqualTo("https://idp.exemplo.com");
        assertThat(registration.getProviderDetails().getConfigurationMetadata())
                .containsEntry("end_session_endpoint", "https://idp.exemplo.com/connect/logout");
    }

    private static AdminProperties properties(String issuer, String clientId) {
        return new AdminProperties(
                new AdminProperties.Idp(URI.create(issuer), URI.create("http://authentication:9000/")),
                new AdminProperties.Authz(URI.create("http://authorization:9100")),
                new AdminProperties.Client(clientId, "segredo"),
                new AdminProperties.Client(null, null),
                URI.create("https://admin.exemplo.com"),
                new AdminProperties.Session(Duration.ofMinutes(30), Duration.ofHours(12)),
                new AdminProperties.Proxy(Duration.ofSeconds(2), Duration.ofSeconds(10)));
    }
}
