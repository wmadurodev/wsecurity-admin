package dev.wmaduro.wsecurity.admin.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SpaFallbackResourceResolverTest {

    @ParameterizedTest
    @ValueSource(strings = {"", "qualquer/rota", "platform/users/123", "tenants/acme/members", "/qualquer"})
    void pageRoutesFallBackToIndex(String path) {
        assertThat(SpaFallbackResourceResolver.isPageRoute(path)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "bff",
                "bff/session",
                "oauth2/authorization/wsecurity",
                "login/oauth2/code/wsecurity",
                "actuator/health",
                "assets/missing-abc123.js",
                "favicon.ico"
            })
    void serverRoutesAndFilesDoNotFallBack(String path) {
        assertThat(SpaFallbackResourceResolver.isPageRoute(path)).isFalse();
    }
}
