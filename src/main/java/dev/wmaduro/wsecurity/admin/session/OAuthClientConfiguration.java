package dev.wmaduro.wsecurity.admin.session;

import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;

/**
 * Registros OAuth do console (DEC-03, DEC-08): {@code wsecurity} (com {@code wsecurity.admin}) e
 * {@code wsecurity-basic} (sem), os dois para o mesmo cliente do IdP. Os endpoints são explícitos, sem descoberta: o
 * navegador usa {@code idp.issuer} (autorização e logout) e o BFF usa {@code idp.internal-uri} (token, JWKS, userinfo
 * e revogação). O {@code iss} do ID token é validado contra {@code idp.issuer}.
 */
@Configuration(proxyBeanMethods = false)
class OAuthClientConfiguration {

    static final String ADMIN_REGISTRATION = "wsecurity";
    static final String BASIC_REGISTRATION = "wsecurity-basic";
    static final String ADMIN_SCOPE = "wsecurity.admin";
    static final Duration REFRESH_MARGIN = Duration.ofSeconds(30);

    @Bean
    ClientRegistrationRepository clientRegistrationRepository(AdminProperties properties) {
        if (!properties.client().isConfigured()) {
            throw new IllegalStateException(
                    "Configure o cliente do console: WSECURITY_ADMIN_CLIENT_ID e WSECURITY_ADMIN_CLIENT_SECRET");
        }
        return new InMemoryClientRegistrationRepository(
                registration(properties, ADMIN_REGISTRATION, Set.of("openid", "profile", "email", ADMIN_SCOPE)),
                registration(properties, BASIC_REGISTRATION, Set.of("openid", "profile", "email")));
    }

    static ClientRegistration registration(AdminProperties properties, String registrationId, Set<String> scopes) {
        String browser = withoutTrailingSlash(properties.idp().issuer().toString());
        String internal = withoutTrailingSlash(properties.idp().internalUri().toString());
        return ClientRegistration.withRegistrationId(registrationId)
                .clientId(properties.client().id())
                .clientSecret(properties.client().secret())
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                .scope(scopes)
                .clientName("wsecurity")
                .issuerUri(browser)
                .authorizationUri(browser + "/oauth2/authorize")
                .tokenUri(internal + "/oauth2/token")
                .jwkSetUri(internal + "/oauth2/jwks")
                .userInfoUri(internal + "/userinfo")
                .userNameAttributeName(IdTokenClaimNames.SUB)
                .providerConfigurationMetadata(Map.of(
                        "end_session_endpoint", browser + "/connect/logout",
                        "revocation_endpoint", internal + "/oauth2/revoke"))
                .build();
    }

    /** Tokens só na sessão do servidor (RN-01). */
    @Bean
    OAuth2AuthorizedClientRepository authorizedClientRepository() {
        return new HttpSessionOAuth2AuthorizedClientRepository();
    }

    /** Renova o access token com o refresh token quando faltam menos de 30 s para expirar (RF-AUT-04). */
    @Bean
    OAuth2AuthorizedClientManager authorizedClientManager(
            ClientRegistrationRepository registrations, OAuth2AuthorizedClientRepository authorizedClients) {
        DefaultOAuth2AuthorizedClientManager manager =
                new DefaultOAuth2AuthorizedClientManager(registrations, authorizedClients);
        manager.setAuthorizedClientProvider(OAuth2AuthorizedClientProviderBuilder.builder()
                .authorizationCode()
                .refreshToken(refresh -> refresh.clockSkew(REFRESH_MARGIN))
                .build());
        return manager;
    }

    static String withoutTrailingSlash(String uri) {
        return uri.endsWith("/") ? uri.substring(0, uri.length() - 1) : uri;
    }
}
