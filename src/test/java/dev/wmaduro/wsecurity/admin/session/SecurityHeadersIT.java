package dev.wmaduro.wsecurity.admin.session;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Cabeçalhos de segurança e de cache (RNF-SEG-04, RNF-SEG-05) e a SPA servida com sessão. */
class SecurityHeadersIT extends AbstractLoginIT {

    @ParameterizedTest
    @ValueSource(strings = {"/", "/qualquer/rota", "/platform/users/123"})
    void spaIsServedWithSessionAndSecurityHeaders(String path) {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());

        HttpResponse<String> page = browser.get(path);

        assertThat(page.statusCode()).isEqualTo(200);
        assertThat(page.body()).contains("spa-de-teste");
        assertThat(page.headers().firstValue("Content-Security-Policy"))
                .hasValue("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
                        + "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' "
                        + idp.baseUrl());
        assertThat(page.headers().firstValue("X-Content-Type-Options")).hasValue("nosniff");
        assertThat(page.headers().firstValue("Referrer-Policy")).hasValue("no-referrer");
        assertThat(page.headers().firstValue("Cross-Origin-Opener-Policy")).hasValue("same-origin");
        assertThat(page.headers().firstValue("Permissions-Policy")).hasValue(SecurityConfiguration.PERMISSIONS_POLICY);
        assertThat(page.headers().firstValue("Cache-Control"))
                .hasValueSatisfying(value -> assertThat(value).contains("no-store"));
        assertThat(page.headers().firstValue("Strict-Transport-Security")).isEmpty();
    }

    @Test
    void bffResponsesAreNotCached() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());

        HttpResponse<String> session = browser.get("/bff/session");

        assertThat(session.headers().firstValue("Cache-Control"))
                .hasValueSatisfying(value -> assertThat(value).contains("no-store"));
    }

    @Test
    void hashedAssetsAreCachedForLongWithoutSession() {
        HttpResponse<String> asset = browser().get("/assets/app-teste.js");

        assertThat(asset.statusCode()).isEqualTo(200);
        assertThat(asset.headers().firstValue("Cache-Control"))
                .hasValueSatisfying(
                        value -> assertThat(value).contains("max-age=31536000").contains("immutable"));
    }
}
