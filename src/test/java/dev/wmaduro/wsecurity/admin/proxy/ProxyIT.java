package dev.wmaduro.wsecurity.admin.proxy;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.absent;
import static com.github.tomakehurst.wiremock.client.WireMock.anyRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.patch;
import static com.github.tomakehurst.wiremock.client.WireMock.patchRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlMatching;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.http.Fault;
import dev.wmaduro.wsecurity.admin.testsupport.AbstractLoginIT;
import dev.wmaduro.wsecurity.admin.testsupport.Browser;
import dev.wmaduro.wsecurity.admin.testsupport.TestIdp;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.TestPropertySource;

/** Proxy autenticado (RF-BFF-01, RF-BFF-02, RF-BFF-04, RF-BFF-05, RNF-SEG-07). */
@ExtendWith(OutputCaptureExtension.class)
@TestPropertySource(properties = "wsecurity.admin.proxy.read-timeout=1s")
class ProxyIT extends AbstractLoginIT {

    @Test
    void forwardsWithTheSessionTokenAndOnlyTheAllowedHeaders() {
        Browser browser = adminSession();
        WIREMOCK.stubFor(get(urlPathEqualTo("/api/admin/v1/users"))
                .willReturn(okJson("{\"content\":[],\"totalElements\":0}")
                        .withHeader("Set-Cookie", "IDP=segredo")
                        .withHeader("X-Interno", "nao-repassar")
                        .withHeader("ETag", "\"7\"")));

        HttpResponse<String> response = browser.get(
                "/bff/api/idp/users?page=0&size=5&q=ana%40exemplo",
                "Accept",
                "application/json",
                "Authorization",
                "Bearer do-navegador",
                "X-Personalizado",
                "nao-repassar");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo("{\"content\":[],\"totalElements\":0}");
        assertThat(response.headers().firstValue("Content-Type"))
                .hasValueSatisfying(type -> assertThat(type).startsWith("application/json"));
        assertThat(response.headers().firstValue("ETag")).hasValue("\"7\"");
        assertThat(response.headers().firstValue("X-Interno")).isEmpty();
        assertThat(response.headers().allValues("Set-Cookie")).noneMatch(cookie -> cookie.startsWith("IDP="));
        WIREMOCK.verify(getRequestedFor(urlEqualTo("/api/admin/v1/users?page=0&size=5&q=ana%40exemplo"))
                .withHeader("Authorization", matchingSessionToken())
                .withHeader("Accept", equalTo("application/json"))
                .withHeader("Cookie", absent())
                .withHeader("X-Personalizado", absent()));
    }

    @Test
    void platformRoutesNeedTheAdminScopeAndAreNotCalledWithoutIt() {
        Browser browser = browser();
        login(browser, "/", Login.asCommonUser());

        HttpResponse<String> idp = browser.get("/bff/api/idp/users");
        HttpResponse<String> platform = browser.get("/bff/api/authz/admin/v1/tenants");

        assertThat(idp.statusCode()).isEqualTo(403);
        assertThat(idp.body()).contains("https://wsecurity.dev/problems/forbidden");
        assertThat(platform.statusCode()).isEqualTo(403);
        WIREMOCK.verify(0, anyRequestedFor(urlMatching("/api/admin/v1/.*")));
    }

    @Test
    void tenantRoutesAreAlwaysForwardedAndTheApiDecides() {
        Browser browser = browser();
        login(browser, "/", Login.asCommonUser());
        WIREMOCK.stubFor(get(urlEqualTo("/api/v1/tenants/acme/members")).willReturn(okJson("{\"content\":[]}")));
        WIREMOCK.stubFor(get(urlEqualTo("/api/v1/tenants/outro/members"))
                .willReturn(aResponse()
                        .withStatus(403)
                        .withHeader("Content-Type", "application/problem+json")
                        .withBody("{\"type\":\"https://wsecurity.dev/problems/forbidden\",\"status\":403}")));

        assertThat(browser.get("/bff/api/authz/v1/tenants/acme/members").statusCode())
                .isEqualTo(200);
        HttpResponse<String> denied = browser.get("/bff/api/authz/v1/tenants/outro/members");
        assertThat(denied.statusCode()).isEqualTo(403);
        assertThat(denied.body()).isEqualTo("{\"type\":\"https://wsecurity.dev/problems/forbidden\",\"status\":403}");
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/bff/api/authz/v1/decisions",
                "/bff/api/authz/admin/v1/subjects/abc",
                "/bff/api/authz/v1/subjects/abc/tenants",
                "/bff/api/authz/oauth2/token",
                "/bff/api/idp/users/abc/sessions",
                "/bff/api/idp",
                "/bff/api/idp/"
            })
    void routesOutsideTheListAnswer404WithoutCallingTheApi(String path) {
        Browser browser = adminSession();

        HttpResponse<String> response =
                browser.post(path, "X-XSRF-TOKEN", browser.cookie("XSRF-TOKEN"), "Content-Type", "application/json");

        assertThat(response.statusCode()).isEqualTo(404);
        WIREMOCK.verify(0, anyRequestedFor(urlMatching("/api/.*")));
    }

    @Test
    void methodsOutsideTheListAnswer404() {
        Browser browser = adminSession();

        HttpResponse<String> sync =
                browser.put("/bff/api/authz/admin/v1/modules/vendas", "X-XSRF-TOKEN", browser.cookie("XSRF-TOKEN"));

        assertThat(sync.statusCode()).isEqualTo(404);
        WIREMOCK.verify(0, anyRequestedFor(urlMatching("/api/.*")));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/bff/api/idp/users/..%2Fclients",
                "/bff/api/idp/users/%2e%2e/clients",
                "/bff/api/idp/users/%2E%2E",
                "/bff/api/idp//users",
                "/bff/api/idp/users;jsessionid=abc",
                "/bff/api/idp/users/a%5Cb",
                "/bff/api/idp/users/a%252Fb",
                "/bff/api/idp/users/../clients"
            })
    void ambiguousPathsAreRejectedBeforeMatching(String path) throws Exception {
        Browser browser = adminSession();
        // Envia o caminho cru, sem normalização do cliente HTTP.
        HttpResponse<String> response = HttpClient.newBuilder()
                .cookieHandler(browser.cookies())
                .build()
                .send(
                        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                                .GET()
                                .build(),
                        HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isIn(400, 404);
        WIREMOCK.verify(0, anyRequestedFor(urlMatching("/api/.*")));
    }

    @Test
    void ifMatchAndEtagAndPreconditionFailedArePassedThrough() {
        Browser browser = adminSession();
        WIREMOCK.stubFor(patch(urlEqualTo("/api/v1/tenants/acme"))
                .willReturn(aResponse()
                        .withStatus(412)
                        .withHeader("Content-Type", "application/problem+json")
                        .withHeader("ETag", "\"9\"")
                        .withBody("{\"type\":\"https://wsecurity.dev/problems/precondition-failed\",\"status\":412}")));

        HttpResponse<String> response = browser.patch(
                "/bff/api/authz/v1/tenants/acme",
                "{\"name\":\"Acme\"}",
                "X-XSRF-TOKEN",
                browser.cookie("XSRF-TOKEN"),
                "Content-Type",
                "application/merge-patch+json",
                "If-Match",
                "\"3\"");

        assertThat(response.statusCode()).isEqualTo(412);
        assertThat(response.headers().firstValue("ETag")).hasValue("\"9\"");
        assertThat(response.headers().firstValue("Content-Type"))
                .hasValueSatisfying(type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(response.body()).contains("precondition-failed");
        WIREMOCK.verify(patchRequestedFor(urlEqualTo("/api/v1/tenants/acme"))
                .withHeader("If-Match", equalTo("\"3\""))
                .withHeader("Content-Type", equalTo("application/merge-patch+json"))
                .withRequestBody(equalTo("{\"name\":\"Acme\"}")));
    }

    @Test
    void locationIsRewrittenToTheBffRoute() {
        Browser browser = adminSession();
        WIREMOCK.stubFor(post(urlEqualTo("/api/admin/v1/users"))
                .willReturn(aResponse()
                        .withStatus(201)
                        .withHeader("Location", "/api/admin/v1/users/abc")
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"id\":\"abc\"}")));
        WIREMOCK.stubFor(post(urlEqualTo("/api/v1/tenants/acme/members"))
                .willReturn(aResponse()
                        .withStatus(201)
                        .withHeader("Location", WIREMOCK.baseUrl() + "/api/v1/tenants/acme/members/s1")));
        WIREMOCK.stubFor(post(urlEqualTo("/api/v1/tenants/acme/roles"))
                .willReturn(aResponse().withStatus(201).withHeader("Location", "https://outro.exemplo/x")));
        String csrf = browser.cookie("XSRF-TOKEN");

        HttpResponse<String> user = browser.postJson("/bff/api/idp/users", "{}", "X-XSRF-TOKEN", csrf);
        HttpResponse<String> member =
                browser.postJson("/bff/api/authz/v1/tenants/acme/members", "{}", "X-XSRF-TOKEN", csrf);
        HttpResponse<String> role =
                browser.postJson("/bff/api/authz/v1/tenants/acme/roles", "{}", "X-XSRF-TOKEN", csrf);

        assertThat(user.headers().firstValue("Location")).hasValue("/bff/api/idp/users/abc");
        assertThat(member.headers().firstValue("Location")).hasValue("/bff/api/authz/v1/tenants/acme/members/s1");
        assertThat(role.headers().firstValue("Location")).isEmpty();
    }

    @Test
    void connectionFailureAnswers502() {
        Browser browser = adminSession();
        WIREMOCK.stubFor(get(urlEqualTo("/api/admin/v1/keys"))
                .willReturn(aResponse().withFault(Fault.CONNECTION_RESET_BY_PEER)));

        HttpResponse<String> response = browser.get("/bff/api/idp/keys");

        assertThat(response.statusCode()).isEqualTo(502);
        assertThat(response.body())
                .contains("https://wsecurity.dev/problems/upstream-unavailable")
                .contains("API indisponível")
                .doesNotContain("localhost");
    }

    @Test
    void slowApiAnswers504() {
        Browser browser = adminSession();
        WIREMOCK.stubFor(
                get(urlEqualTo("/api/admin/v1/keys")).willReturn(okJson("[]").withFixedDelay(2_500)));

        HttpResponse<String> response = browser.get("/bff/api/idp/keys");

        assertThat(response.statusCode()).isEqualTo(504);
        assertThat(response.body()).contains("https://wsecurity.dev/problems/upstream-timeout");
    }

    @Test
    void expiringTokenIsRefreshedBeforeForwarding() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin().expiringIn(10));
        String renewed = "access-renovado-" + UUID.randomUUID();
        idp.stubRefresh(new TestIdp.Tokens(
                renewed, "refresh-novo", "openid profile email wsecurity.admin", 300, idp.baseUrl(), null, List.of()));
        WIREMOCK.stubFor(get(urlEqualTo("/api/admin/v1/scopes")).willReturn(okJson("[]")));

        assertThat(browser.get("/bff/api/idp/scopes").statusCode()).isEqualTo(200);

        WIREMOCK.verify(getRequestedFor(urlEqualTo("/api/admin/v1/scopes"))
                .withHeader("Authorization", equalTo("Bearer " + renewed)));
    }

    @Test
    void bodiesAboveOneMebibyteAreRefused() {
        Browser browser = adminSession();

        HttpResponse<String> response = browser.postJson(
                "/bff/api/idp/users", "x".repeat(1024 * 1024 + 1), "X-XSRF-TOKEN", browser.cookie("XSRF-TOKEN"));

        assertThat(response.statusCode()).isEqualTo(413);
        WIREMOCK.verify(0, anyRequestedFor(urlMatching("/api/.*")));
    }

    @Test
    void writesAreLoggedWithoutBodyTokenOrCookie(CapturedOutput output) {
        Browser browser = adminSession();
        WIREMOCK.stubFor(
                post(urlEqualTo("/api/admin/v1/scopes")).willReturn(aResponse().withStatus(201)));

        browser.postJson(
                "/bff/api/idp/scopes", "{\"name\":\"segredo-do-corpo\"}", "X-XSRF-TOKEN", browser.cookie("XSRF-TOKEN"));

        assertThat(output.getOut())
                .contains("Escrita pelo proxy: POST /bff/api/idp/scopes → 201")
                .doesNotContain("segredo-do-corpo")
                .doesNotContain(browser.cookie("WSADMIN_SESSION"))
                .doesNotContain("access-");
    }

    @Test
    void userAccessWithoutServiceCredentialsAnswers503() {
        Browser browser = adminSession();

        HttpResponse<String> response = browser.get("/bff/users/" + TestIdp.SUBJECT + "/access");

        assertThat(response.statusCode()).isEqualTo(503);
        assertThat(response.body()).contains("WSECURITY_ADMIN_SERVICE_CLIENT_ID");
    }

    private Browser adminSession() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        browser.get("/bff/session");
        WIREMOCK.resetRequests();
        return browser;
    }

    private static com.github.tomakehurst.wiremock.matching.StringValuePattern matchingSessionToken() {
        return com.github.tomakehurst.wiremock.client.WireMock.matching("Bearer access-.*");
    }
}
