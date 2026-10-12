package dev.wmaduro.wsecurity.admin.testsupport;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * IdP e autorização simulados no WireMock: JWKS, tokens (código e refresh), userinfo, revogação e as APIs
 * {@code /api/v1/me/**}. Os tokens de acesso são opacos para o BFF; o ID token é um JWT assinado pela chave do JWKS.
 */
public final class TestIdp {

    public static final String CLIENT_ID = "console-de-teste";
    public static final String SUBJECT = "c0ffee00-0000-4000-8000-000000000001";

    private static final RSAKey KEY = generateKey();

    private final WireMockServer server;

    public TestIdp(WireMockServer server) {
        this.server = server;
    }

    public String baseUrl() {
        return server.baseUrl();
    }

    public void stubDefaults() {
        server.resetAll();
        server.stubFor(get(urlEqualTo("/oauth2/jwks")).willReturn(okJson(new JWKSet(KEY.toPublicJWK()).toString())));
        server.stubFor(get(urlEqualTo("/userinfo"))
                .willReturn(
                        okJson("{\"sub\":\"" + SUBJECT + "\",\"name\":\"Ana Admin\",\"email\":\"ana@exemplo.com\"}")));
        server.stubFor(post(urlEqualTo("/oauth2/revoke")).willReturn(aResponse().withStatus(200)));
        server.stubFor(get(urlEqualTo("/api/v1/me/tenants"))
                .willReturn(okJson("[{\"tenantId\":\"" + UUID.randomUUID()
                        + "\",\"slug\":\"acme\",\"name\":\"Acme\",\"roles\":[\"owner\"],\"isDefault\":true},"
                        + "{\"tenantId\":\"" + UUID.randomUUID()
                        + "\",\"slug\":\"loja\",\"name\":\"Loja\",\"roles\":[\"viewer\"],\"isDefault\":false}]")));
        server.stubFor(get(urlEqualTo("/api/v1/me/tenants/acme/permissions"))
                .willReturn(okJson("{\"tenant\":\"acme\",\"subject\":\"" + SUBJECT
                        + "\",\"roles\":[\"owner\"],\"permissions\":[\"core.members:write\",\"demo.orders:write\"]}")));
        server.stubFor(get(urlEqualTo("/api/v1/me/tenants/loja/permissions"))
                .willReturn(okJson("{\"tenant\":\"loja\",\"subject\":\"" + SUBJECT
                        + "\",\"roles\":[\"viewer\"],\"permissions\":[\"demo.orders:read\"]}")));
    }

    /** Resposta do endpoint de token para um código: tokens com os escopos, validade e emissor indicados. */
    public void stubCode(String code, Tokens tokens) {
        server.stubFor(post(urlPathEqualTo("/oauth2/token"))
                .withRequestBody(containing("grant_type=authorization_code"))
                .withRequestBody(containing("code=" + code))
                .willReturn(okJson(tokens.json())));
    }

    public void stubRefresh(Tokens tokens) {
        server.stubFor(post(urlPathEqualTo("/oauth2/token"))
                .withRequestBody(containing("grant_type=refresh_token"))
                .willReturn(okJson(tokens.json())));
    }

    public void stubRefreshRefused() {
        server.stubFor(post(urlPathEqualTo("/oauth2/token"))
                .withRequestBody(containing("grant_type=refresh_token"))
                .willReturn(aResponse()
                        .withStatus(400)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"error\":\"invalid_grant\"}")));
    }

    public WireMockServer server() {
        return server;
    }

    /** Tokens devolvidos pelo IdP simulado. */
    public record Tokens(
            String accessToken,
            String refreshToken,
            String scope,
            long expiresIn,
            String issuer,
            String nonce,
            List<String> amr) {

        public String json() {
            return "{\"access_token\":\"" + accessToken + "\",\"token_type\":\"Bearer\",\"expires_in\":" + expiresIn
                    + ",\"scope\":\"" + scope + "\",\"refresh_token\":\"" + refreshToken + "\",\"id_token\":\""
                    + idToken(issuer, nonce, amr) + "\"}";
        }
    }

    public static String idToken(String issuer, String nonce, List<String> amr) {
        Instant now = Instant.now();
        JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject(SUBJECT)
                .audience(CLIENT_ID)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(300)))
                .claim("name", "Ana Admin")
                .claim("email", "ana@exemplo.com")
                .claim("amr", amr);
        if (nonce != null) {
            claims.claim("nonce", nonce);
        }
        try {
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.RS256)
                            .keyID(KEY.getKeyID())
                            .build(),
                    claims.build());
            jwt.sign(new RSASSASigner(KEY));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    private static RSAKey generateKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("chave-de-teste").generate();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }
}
