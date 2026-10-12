package dev.wmaduro.wsecurity.admin.session;

import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import dev.wmaduro.wsecurity.admin.shared.ApiClients;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Logout (RF-AUT-06): revoga o refresh token no IdP (falha registrada e ignorada), invalida a sessão (Spring Security)
 * e leva ao RP-Initiated Logout do IdP ({@code /connect/logout} com {@code id_token_hint} e
 * {@code post_logout_redirect_uri}).
 */
final class LogoutHandlers {

    private static final Logger log = LoggerFactory.getLogger(LogoutHandlers.class);

    private LogoutHandlers() {}

    /** Revoga o refresh token da sessão antes de ela ser invalidada. */
    static LogoutHandler revocation(
            OAuth2AuthorizedClientRepository authorizedClients, ApiClients clients, AdminProperties properties) {
        RestClient idp = clients.idp();
        return (request, response, authentication) -> {
            if (!(authentication instanceof OAuth2AuthenticationToken login)) {
                return;
            }
            OAuth2AuthorizedClient client =
                    authorizedClients.loadAuthorizedClient(login.getAuthorizedClientRegistrationId(), login, request);
            OAuth2RefreshToken refreshToken = client == null ? null : client.getRefreshToken();
            if (refreshToken == null) {
                return;
            }
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("token", refreshToken.getTokenValue());
            form.add("token_type_hint", "refresh_token");
            try {
                idp.post()
                        .uri("/oauth2/revoke")
                        .headers(headers -> headers.setBasicAuth(
                                properties.client().id(), properties.client().secret()))
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(form)
                        .retrieve()
                        .toBodilessEntity();
            } catch (RestClientException e) {
                log.warn(
                        "Falha ao revogar o refresh token no logout (ignorada): {}",
                        e.getClass().getSimpleName());
            }
        };
    }

    /**
     * Redireciona ao logout do IdP. Uma chamada da SPA ({@code Accept: application/json}, feita com {@code fetch} e o
     * cabeçalho CSRF) recebe {@code 200 {"redirectUrl": ...}} e navega até lá; um formulário recebe {@code 302}.
     */
    static OidcClientInitiatedLogoutSuccessHandler success(
            ClientRegistrationRepository registrations, String postLogoutRedirectUri) {
        OidcClientInitiatedLogoutSuccessHandler handler = new OidcClientInitiatedLogoutSuccessHandler(registrations) {
            @Override
            public void onLogoutSuccess(
                    HttpServletRequest request, HttpServletResponse response, Authentication authentication)
                    throws IOException, jakarta.servlet.ServletException {
                if (!wantsJson(request)) {
                    super.onLogoutSuccess(request, response, authentication);
                    return;
                }
                String target = determineTargetUrl(request, response, authentication);
                response.setStatus(HttpServletResponse.SC_OK);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write("{\"redirectUrl\":\"" + target.replace("\"", "%22") + "\"}");
            }
        };
        handler.setPostLogoutRedirectUri(postLogoutRedirectUri);
        handler.setDefaultTargetUrl("/");
        return handler;
    }

    private static boolean wantsJson(HttpServletRequest request) {
        String accept = request.getHeader(HttpHeaders.ACCEPT);
        return accept != null && accept.contains(MediaType.APPLICATION_JSON_VALUE);
    }
}
