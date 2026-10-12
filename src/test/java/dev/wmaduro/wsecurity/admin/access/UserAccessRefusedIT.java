package dev.wmaduro.wsecurity.admin.access;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.anyRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlMatching;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;

import dev.wmaduro.wsecurity.admin.testsupport.AbstractLoginIT;
import dev.wmaduro.wsecurity.admin.testsupport.Browser;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

/** Credenciais do cliente de serviço recusadas pelo IdP (RF-BFF-03): contexto próprio, sem token em cache. */
@TestPropertySource(
        properties = {
            "wsecurity.admin.service-client.id=servico-recusado",
            "wsecurity.admin.service-client.secret=segredo-errado"
        })
class UserAccessRefusedIT extends AbstractLoginIT {

    @Test
    void refusedServiceCredentialsAnswer503() {
        Browser browser = browser();
        login(browser, "/", Login.asAdmin());
        WIREMOCK.stubFor(post(urlPathEqualTo("/oauth2/token"))
                .withRequestBody(containing("grant_type=client_credentials"))
                .willReturn(aResponse()
                        .withStatus(401)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"error\":\"invalid_client\"}")));
        WIREMOCK.resetRequests();

        HttpResponse<String> response = browser.get("/bff/users/u-0002/access");

        assertThat(response.statusCode()).isEqualTo(503);
        assertThat(response.body()).contains("recusou as credenciais do cliente de serviço");
        WIREMOCK.verify(0, anyRequestedFor(urlMatching("/api/v1/subjects/.*")));
    }
}
