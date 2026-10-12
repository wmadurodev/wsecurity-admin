package dev.wmaduro.wsecurity.admin.testsupport;

import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.options;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Base dos testes de login: BFF real numa porta aleatória e IdP/autorização simulados no WireMock. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "management.server.port=0")
public abstract class AbstractLoginIT {

    public static final WireMockServer WIREMOCK =
            new WireMockServer(options().dynamicPort().gzipDisabled(true));

    static {
        WIREMOCK.start();
    }

    @DynamicPropertySource
    static void apis(DynamicPropertyRegistry registry) {
        registry.add("wsecurity.admin.idp.issuer", WIREMOCK::baseUrl);
        registry.add("wsecurity.admin.idp.internal-uri", WIREMOCK::baseUrl);
        registry.add("wsecurity.admin.authz.uri", WIREMOCK::baseUrl);
    }

    @LocalServerPort
    protected int port;

    protected final TestIdp idp = new TestIdp(WIREMOCK);

    @BeforeEach
    protected void stubApis() {
        idp.stubDefaults();
    }

    protected Browser browser() {
        return new Browser("http://localhost:" + port);
    }

    /** Opções do login simulado. */
    public record Login(boolean admin, long expiresIn, String issuer, List<String> amr) {

        public static Login asAdmin() {
            return new Login(true, 300, null, List.of("pwd"));
        }

        public static Login asCommonUser() {
            return new Login(false, 300, null, List.of("pwd"));
        }

        public Login expiringIn(long seconds) {
            return new Login(admin, seconds, issuer, amr);
        }

        public Login issuedBy(String otherIssuer) {
            return new Login(admin, expiresIn, otherIssuer, amr);
        }

        public Login withAmr(List<String> methods) {
            return new Login(admin, expiresIn, issuer, methods);
        }
    }

    /**
     * Faz o login completo a partir de uma página: redireciona ao IdP, recua o escopo para usuário comum e devolve a
     * resposta do retorno (callback) do login.
     */
    protected HttpResponse<String> login(Browser browser, String page, Login login) {
        HttpResponse<String> response = browser.get(page);
        assertThat(response.statusCode()).isEqualTo(302);
        assertThat(Browser.location(response)).endsWith("/oauth2/authorization/wsecurity");

        Map<String, String> authorize = authorize(browser, Browser.location(response));
        assertThat(authorize.get("scope")).contains("wsecurity.admin");
        String registration = "wsecurity";
        if (!login.admin()) {
            response = browser.get("/login/oauth2/code/wsecurity?error=invalid_scope&state=" + authorize.get("state"));
            assertThat(response.statusCode()).isEqualTo(302);
            assertThat(Browser.location(response)).endsWith("/oauth2/authorization/wsecurity-basic");
            authorize = authorize(browser, Browser.location(response));
            assertThat(authorize.get("scope")).doesNotContain("wsecurity.admin");
            registration = "wsecurity-basic";
        }

        String code = "codigo-" + UUID.randomUUID();
        String scope = login.admin() ? "openid profile email wsecurity.admin" : "openid profile email";
        idp.stubCode(
                code,
                new TestIdp.Tokens(
                        "access-" + UUID.randomUUID(),
                        "refresh-" + UUID.randomUUID(),
                        scope,
                        login.expiresIn(),
                        login.issuer() == null ? idp.baseUrl() : login.issuer(),
                        authorize.get("nonce"),
                        login.amr()));
        return browser.get("/login/oauth2/code/" + registration + "?code=" + code + "&state=" + authorize.get("state"));
    }

    /** Segue o início do login até o IdP e devolve os parâmetros do pedido de autorização. */
    protected Map<String, String> authorize(Browser browser, String start) {
        HttpResponse<String> response = browser.get(start);
        assertThat(response.statusCode()).isEqualTo(302);
        String location = Browser.location(response);
        assertThat(location).startsWith(idp.baseUrl() + "/oauth2/authorize");
        return Browser.query(location);
    }
}
