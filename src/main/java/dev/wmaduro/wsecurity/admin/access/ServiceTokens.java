package dev.wmaduro.wsecurity.admin.access;

import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import java.util.Optional;
import org.springframework.security.oauth2.client.AuthorizedClientServiceOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.InMemoryOAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.stereotype.Component;

/**
 * Token {@code client_credentials} do cliente de serviço do console ({@code wsecurity.authz}, DEC-07), só no servidor,
 * em memória e renovado ao expirar. É usado apenas para consultar os acessos de um usuário (RF-BFF-03, RN-04). O
 * registro fica fora do repositório do login, para não poder ser usado como login.
 */
@Component
class ServiceTokens {

    static final String REGISTRATION = "wsecurity-service";
    static final String SCOPE = "wsecurity.authz";
    private static final String PRINCIPAL = "wsecurity-admin";

    private final AuthorizedClientServiceOAuth2AuthorizedClientManager manager;

    ServiceTokens(AdminProperties properties) {
        this.manager = properties.serviceClient().isConfigured() ? manager(properties) : null;
    }

    boolean configured() {
        return manager != null;
    }

    /** Access token do cliente de serviço, ou vazio sem credenciais configuradas. */
    Optional<String> accessToken() {
        if (manager == null) {
            return Optional.empty();
        }
        OAuth2AuthorizedClient client = manager.authorize(OAuth2AuthorizeRequest.withClientRegistrationId(REGISTRATION)
                .principal(PRINCIPAL)
                .build());
        return Optional.ofNullable(client)
                .map(authorized -> authorized.getAccessToken().getTokenValue());
    }

    private static AuthorizedClientServiceOAuth2AuthorizedClientManager manager(AdminProperties properties) {
        String internal = properties.idp().internalUri().toString().replaceAll("/+$", "");
        ClientRegistration registration = ClientRegistration.withRegistrationId(REGISTRATION)
                .clientId(properties.serviceClient().id())
                .clientSecret(properties.serviceClient().secret())
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .scope(SCOPE)
                .tokenUri(internal + "/oauth2/token")
                .build();
        InMemoryClientRegistrationRepository registrations = new InMemoryClientRegistrationRepository(registration);
        AuthorizedClientServiceOAuth2AuthorizedClientManager manager =
                new AuthorizedClientServiceOAuth2AuthorizedClientManager(
                        registrations, new InMemoryOAuth2AuthorizedClientService(registrations));
        manager.setAuthorizedClientProvider(OAuth2AuthorizedClientProviderBuilder.builder()
                .clientCredentials()
                .build());
        return manager;
    }
}
