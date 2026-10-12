package dev.wmaduro.wsecurity.admin.session;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Login com recuo de escopo, sessão, renovação e logout (RF-AUT-01..07, RNF-QUA-01). */
class LoginFlowIT extends AbstractLoginIT {

    @Test
    void adminLogsInAndReturnsToTheRequestedPage() {
        Browser browser = browser();

        HttpResponse<String> callback = login(browser, "/platform/users?page=2", Login.asAdmin());

        assertThat(callback.statusCode()).isEqualTo(302);
        assertThat(Browser.location(callback)).endsWith("/platform/users?page=2&continue");
        HttpResponse<String> session = browser.get("/bff/session");
        assertThat(session.statusCode()).isEqualTo(200);
        assertThat(session.body())
                .contains("\"platformAdmin\":true")
                .contains("\"sub\":\"" + TestIdp.SUBJECT + "\"")
                .contains("\"email\":\"ana@exemplo.com\"")
                .contains("\"name\":\"Ana Admin\"")
                .contains("\"mfa\":false")
                .contains("\"slug\":\"acme\"")
                .contains("\"tenantsAvailable\":true")
                .doesNotContain("\"slug\":\"loja\"");
    }

    @Test
    void authorizationRequestUsesPkceAndTheBrowserAddressOfTheIdp() {
        Browser browser = browser();

        Map<String, String> authorize = authorize(browser, "/oauth2/authorization/wsecurity");

        assertThat(authorize)
                .containsEntry("response_type", "code")
                .containsEntry("client_id", TestIdp.CLIENT_ID)
                .containsEntry("code_challenge_method", "S256")
                .containsKeys("code_challenge", "state", "nonce");
        assertThat(authorize.get("redirect_uri"))
                .isEqualTo("http://localhost:" + port + "/login/oauth2/code/wsecurity");
    }

    @Test
    void commonUserFallsBackToTheBasicRegistrationWithoutSeeingAnError() {
        Browser browser = browser();

        HttpResponse<String> callback = login(browser, "/", Login.asCommonUser());

        assertThat(callback.statusCode()).isEqualTo(302);
        assertThat(Browser.location(callback)).doesNotContain("login-error");
        HttpResponse<String> session = browser.get("/bff/session");
        assertThat(session.statusCode()).isEqualTo(200);
        assertThat(session.body()).contains("\"platformAdmin\":false").contains("\"slug\":\"acme\"");
    }

    @Test
    void fallbackHappensOnlyOnceAndOtherErrorsGoToTheErrorPage() {
        Browser browser = browser();
        Map<String, String> admin = authorize(browser, "/oauth2/authorization/wsecurity");
        HttpResponse<String> response =
                browser.get("/login/oauth2/code/wsecurity?error=invalid_scope&state=" + admin.get("state"));
        assertThat(Browser.location(response)).endsWith("/oauth2/authorization/wsecurity-basic");
        Map<String, String> basic = authorize(browser, Browser.location(response));

        // O registro sem wsecurity.admin não recua de novo: qualquer erro vai para a página de erro.
        response = browser.get("/login/oauth2/code/wsecurity-basic?error=invalid_scope&state=" + basic.get("state"));

        assertThat(response.statusCode()).isEqualTo(302);
        assertThat(Browser.location(response)).endsWith("/login-error");
    }

    @Test
    void accessDeniedGoesToTheErrorPage() {
        Browser browser = browser();
        Map<String, String> admin = authorize(browser, "/oauth2/authorization/wsecurity");

        HttpResponse<String> response =
                browser.get("/login/oauth2/code/wsecurity?error=access_denied&state=" + admin.get("state"));

        assertThat(Browser.location(response)).endsWith("/login-error");
        HttpResponse<String> page = browser.get("/login-error");
        assertThat(page.statusCode()).isEqualTo(200);
        assertThat(page.body()).contains("Não foi possível entrar").contains("Tentar de novo");
    }

    @Test
    void idTokenFromAnotherIssuerIsRefused() {
        Browser browser = browser();

        HttpResponse<String> callback = login(browser, "/", Login.asAdmin().issuedBy("http://outro-emissor"));

        assertThat(Browser.location(callback)).endsWith("/login-error");
        assertThat(browser.get("/bff/session").statusCode()).isEqualTo(401);
    }

    @Test
    void mfaComesFromTheAmrClaim() {
        Browser browser = browser();

        login(browser, "/", Login.asAdmin().withAmr(List.of("pwd", "otp")));

        assertThat(browser.get("/bff/session").body()).contains("\"mfa\":true");
    }

    @Test
    void sessionNeverExposesTokens() {
        Browser browser = browser();
        HttpResponse<String> callback = login(browser, "/", Login.asAdmin());

        HttpResponse<String> session = browser.get("/bff/session");

        String everything =
                callback.headers().map() + callback.body() + session.headers().map() + session.body();
        assertThat(everything)
                .doesNotContain("access-")
                .doesNotContain("refresh-")
                .doesNotContain("eyJ");
        assertThat(callback.headers().allValues("Set-Cookie"))
                .anySatisfy(cookie -> assertThat(cookie)
                        .startsWith("WSADMIN_SESSION=")
                        .contains("HttpOnly")
                        .containsIgnoringCase("SameSite=Lax")
                        .contains("Path=/"));
    }

    @Test
    void expiringAccessTokenIsRefreshedBeforeTheCall() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin().expiringIn(10));
        String renewed = "access-renovado-" + UUID.randomUUID();
        idp.stubRefresh(new TestIdp.Tokens(
                renewed,
                "refresh-novo",
                "openid profile email wsecurity.admin",
                300,
                idp.baseUrl(),
                null,
                List.of("pwd")));

        HttpResponse<String> session = browser.get("/bff/session");

        assertThat(session.statusCode()).isEqualTo(200);
        WIREMOCK.verify(
                postRequestedFor(urlEqualTo("/oauth2/token")).withRequestBody(containing("grant_type=refresh_token")));
        WIREMOCK.verify(
                com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor(urlEqualTo("/api/v1/me/tenants"))
                        .withHeader("Authorization", equalTo("Bearer " + renewed)));
    }

    @Test
    void refusedRefreshEndsTheSession() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin().expiringIn(10));
        idp.stubRefreshRefused();

        HttpResponse<String> session = browser.get("/bff/session");

        assertThat(session.statusCode()).isEqualTo(401);
        assertThat(session.headers().firstValue("Content-Type"))
                .hasValueSatisfying(type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(session.body()).contains("https://wsecurity.dev/problems/session-expired");
        assertThat(browser.get("/bff/session").body()).contains("https://wsecurity.dev/problems/unauthenticated");
    }

    @Test
    void tenantsUnavailableWhenTheAuthorizationApiFails() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        WIREMOCK.stubFor(
                get(urlEqualTo("/api/v1/me/tenants")).willReturn(aResponse().withStatus(500)));

        HttpResponse<String> session = browser.get("/bff/session");

        assertThat(session.statusCode()).isEqualTo(200);
        assertThat(session.body()).contains("\"tenants\":[]").contains("\"tenantsAvailable\":false");
    }

    @Test
    void logoutRevokesTheRefreshTokenAndRedirectsToTheIdp() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        browser.get("/bff/session");
        String csrf = browser.cookie("XSRF-TOKEN");
        assertThat(csrf).isNotBlank();

        HttpResponse<String> logout = browser.post("/bff/logout", "X-XSRF-TOKEN", csrf);

        assertThat(logout.statusCode()).isEqualTo(302);
        String location = Browser.location(logout);
        assertThat(location).startsWith(idp.baseUrl() + "/connect/logout?");
        assertThat(Browser.query(location))
                .containsKey("id_token_hint")
                .containsEntry("post_logout_redirect_uri", "http://localhost:" + port + "/");
        WIREMOCK.verify(postRequestedFor(urlEqualTo("/oauth2/revoke"))
                .withRequestBody(containing("token_type_hint=refresh_token"))
                .withHeader("Authorization", containing("Basic ")));
        assertThat(browser.get("/bff/session").statusCode()).isEqualTo(401);
        assertThat(Browser.location(browser.get("/"))).endsWith("/oauth2/authorization/wsecurity");
    }

    @Test
    void logoutFromTheSpaAnswersWithTheIdpAddress() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        browser.get("/bff/session");

        HttpResponse<String> logout =
                browser.post("/bff/logout", "X-XSRF-TOKEN", browser.cookie("XSRF-TOKEN"), "Accept", "application/json");

        assertThat(logout.statusCode()).isEqualTo(200);
        assertThat(logout.body()).startsWith("{\"redirectUrl\":\"" + idp.baseUrl() + "/connect/logout?");
    }

    @Test
    void logoutStillWorksWhenRevocationFails() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        browser.get("/bff/session");
        WIREMOCK.stubFor(com.github.tomakehurst.wiremock.client.WireMock.post(urlEqualTo("/oauth2/revoke"))
                .willReturn(aResponse().withStatus(503)));

        HttpResponse<String> logout = browser.post("/bff/logout", "X-XSRF-TOKEN", browser.cookie("XSRF-TOKEN"));

        assertThat(logout.statusCode()).isEqualTo(302);
        assertThat(browser.get("/bff/session").statusCode()).isEqualTo(401);
    }

    @Test
    void postWithoutCsrfHeaderIsForbidden() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        browser.get("/bff/session");

        HttpResponse<String> logout = browser.post("/bff/logout");

        assertThat(logout.statusCode()).isEqualTo(403);
        assertThat(browser.get("/bff/session").statusCode()).isEqualTo(200);
    }

    @Test
    void noAccessPageShowsTheEmailAndALogoutForm() {
        Browser browser = browser();
        login(browser, "/", Login.asCommonUser());

        HttpResponse<String> page = browser.get("/no-access");

        assertThat(page.statusCode()).isEqualTo(200);
        assertThat(page.body())
                .contains("Você não tem acesso administrativo")
                .contains("ana@exemplo.com")
                .contains("action=\"/bff/logout\"")
                .contains("name=\"_csrf\"");
        String token = page.body().replaceAll("(?s).*name=\"_csrf\" value=\"([^\"]+)\".*", "$1");
        HttpResponse<String> logout = browser.postForm("/bff/logout", "_csrf=" + token);
        assertThat(logout.statusCode()).isEqualTo(302);
        assertThat(Browser.location(logout)).startsWith(idp.baseUrl() + "/connect/logout?");
    }
}
