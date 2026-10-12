package dev.wmaduro.wsecurity.admin;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "management.server.port=0")
class ApplicationIT {

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${local.management.port}")
    private int managementPort;

    @Value("${local.server.port}")
    private int serverPort;

    @ParameterizedTest
    @ValueSource(strings = {"/", "/qualquer/rota", "/platform/users/123", "/no-access"})
    void pagesWithoutSessionGoToTheLogin(String path) throws Exception {
        HttpResponse<String> response = get(serverPort, path);

        assertThat(response.statusCode()).isEqualTo(302);
        assertThat(response.headers().firstValue("Location"))
                .hasValueSatisfying(location -> assertThat(location).endsWith("/oauth2/authorization/wsecurity"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/bff/session", "/bff/qualquer"})
    void bffWithoutSessionAnswers401ProblemDetails(String path) throws Exception {
        HttpResponse<String> response = get(serverPort, path);

        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(response.headers().firstValue("Content-Type"))
                .hasValueSatisfying(type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(response.body())
                .contains("\"type\":\"https://wsecurity.dev/problems/unauthenticated\"")
                .contains("\"status\":401");
    }

    @Test
    void loginStartRedirectsToTheIdpAuthorizationEndpoint() throws Exception {
        HttpResponse<String> response = get(serverPort, "/oauth2/authorization/wsecurity");

        assertThat(response.statusCode()).isEqualTo(302);
        assertThat(response.headers().firstValue("Location"))
                .hasValueSatisfying(
                        location -> assertThat(location).startsWith("http://localhost:9000/oauth2/authorize?"));
    }

    @Test
    void loginErrorPageAndMissingAssetsNeedNoSession() throws Exception {
        assertThat(get(serverPort, "/login-error").statusCode()).isEqualTo(200);
        assertThat(get(serverPort, "/pages/console.css").statusCode()).isEqualTo(200);
        assertThat(get(serverPort, "/assets/inexistente-abc.js").statusCode()).isEqualTo(404);
    }

    @Test
    void healthLivenessAndReadinessAreUp() throws Exception {
        for (String path :
                new String[] {"/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness"}) {
            HttpResponse<String> response = get(managementPort, path);

            assertThat(response.statusCode()).as(path).isEqualTo(200);
            assertThat(response.body()).as(path).contains("\"status\":\"UP\"");
        }
    }

    @Test
    void actuatorExposesOnlyHealthAndInfo() throws Exception {
        assertThat(get(managementPort, "/actuator/info").statusCode()).isEqualTo(200);
        assertThat(get(managementPort, "/actuator/env").statusCode()).isEqualTo(404);
        assertThat(get(managementPort, "/actuator/configprops").statusCode()).isEqualTo(404);
    }

    @Test
    void actuatorIsNotExposedOnApplicationPort() throws Exception {
        HttpResponse<String> response = get(serverPort, "/actuator/health");

        assertThat(response.statusCode()).isNotEqualTo(200);
    }

    private HttpResponse<String> get(int port, String path) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
