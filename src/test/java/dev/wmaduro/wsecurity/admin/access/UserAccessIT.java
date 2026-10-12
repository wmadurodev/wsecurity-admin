package dev.wmaduro.wsecurity.admin.access;

import static com.github.tomakehurst.wiremock.client.WireMock.anyRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlMatching;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.client.WireMock;
import dev.wmaduro.wsecurity.admin.testsupport.AbstractLoginIT;
import dev.wmaduro.wsecurity.admin.testsupport.Browser;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** Acessos de um usuário com o cliente de serviço (RF-BFF-03, DEC-07, RN-04). */
@TestPropertySource(
        properties = {
            "wsecurity.admin.service-client.id=servico-de-teste",
            "wsecurity.admin.service-client.secret=segredo-do-servico"
        })
class UserAccessIT extends AbstractLoginIT {

    private static final String USER = "u-0001";

    @BeforeEach
    void stubSubjectApis() {
        WIREMOCK.stubFor(post(urlPathEqualTo("/oauth2/token"))
                .withRequestBody(containing("grant_type=client_credentials"))
                .willReturn(okJson("{\"access_token\":\"token-do-servico\",\"token_type\":\"Bearer\","
                        + "\"expires_in\":300,\"scope\":\"wsecurity.authz\"}")));
        WIREMOCK.stubFor(get(urlEqualTo("/api/v1/subjects/" + USER + "/tenants"))
                .willReturn(okJson("[{\"slug\":\"acme\",\"name\":\"Acme\",\"roles\":[\"admin\"]}]")));
        WIREMOCK.stubFor(get(urlEqualTo("/api/v1/subjects/" + USER + "/tenants/acme/permissions"))
                .willReturn(okJson("{\"roles\":[\"admin\"],\"permissions\":[\"core.members:write\"]}")));
    }

    @Test
    void platformAdminSeesTheTenantsRolesAndPermissionsOfAUser() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());

        HttpResponse<String> first = browser.get("/bff/users/" + USER + "/access");
        HttpResponse<String> second = browser.get("/bff/users/" + USER + "/access");

        assertThat(first.statusCode()).isEqualTo(200);
        assertThat(first.body())
                .isEqualTo("{\"sub\":\"u-0001\",\"tenants\":[{\"slug\":\"acme\",\"name\":\"Acme\","
                        + "\"roles\":[\"admin\"],\"permissions\":[\"core.members:write\"]}]}");
        assertThat(second.statusCode()).isEqualTo(200);
        WIREMOCK.verify(
                2,
                getRequestedFor(urlEqualTo("/api/v1/subjects/" + USER + "/tenants"))
                        .withHeader("Authorization", equalTo("Bearer token-do-servico")));
        // O token do serviço fica em memória e é reaproveitado.
        WIREMOCK.verify(
                1,
                postRequestedFor(urlPathEqualTo("/oauth2/token"))
                        .withRequestBody(containing("grant_type=client_credentials")));
        assertThat(first.body()).doesNotContain("token-do-servico");
    }

    @Test
    void commonUserCannotSeeAccessOfOthers() {
        Browser browser = browser();
        login(browser, "/", Login.asCommonUser());
        WIREMOCK.resetRequests();

        HttpResponse<String> response = browser.get("/bff/users/" + USER + "/access");

        assertThat(response.statusCode()).isEqualTo(403);
        WIREMOCK.verify(0, anyRequestedFor(urlMatching("/api/v1/subjects/.*")));
    }

    @Test
    void apiErrorsArePassedThrough() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        WIREMOCK.stubFor(get(urlEqualTo("/api/v1/subjects/inexistente/tenants"))
                .willReturn(WireMock.aResponse()
                        .withStatus(404)
                        .withHeader("Content-Type", "application/problem+json")
                        .withBody("{\"status\":404}")));

        HttpResponse<String> response = browser.get("/bff/users/inexistente/access");

        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.body()).isEqualTo("{\"status\":404}");
    }
}
