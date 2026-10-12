package dev.wmaduro.wsecurity.admin.session;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.stereotype.Component;

/**
 * Tokens da sessão do usuário (RN-01): ficam no servidor e são renovados pelo {@link OAuth2AuthorizedClientManager}
 * quando estão perto de expirar (RF-AUT-04). Se a renovação falhar, a sessão do console é encerrada e a chamada
 * responde {@code 401 session-expired}.
 */
@Component
public class SessionTokens {

    private static final Logger log = LoggerFactory.getLogger(SessionTokens.class);

    private final OAuth2AuthorizedClientManager manager;

    SessionTokens(OAuth2AuthorizedClientManager manager) {
        this.manager = manager;
    }

    /** Cliente autorizado da sessão atual, renovado se preciso. */
    public OAuth2AuthorizedClient authorizedClient(HttpServletRequest request, HttpServletResponse response) {
        if (!(SecurityContextHolder.getContext().getAuthentication() instanceof OAuth2AuthenticationToken login)) {
            throw new IllegalStateException("Sem login OAuth na sessão");
        }
        OAuth2AuthorizeRequest authorize = OAuth2AuthorizeRequest.withClientRegistrationId(
                        login.getAuthorizedClientRegistrationId())
                .principal(login)
                .attribute(HttpServletRequest.class.getName(), request)
                .attribute(HttpServletResponse.class.getName(), response)
                .build();
        try {
            OAuth2AuthorizedClient client = manager.authorize(authorize);
            if (client == null) {
                throw new SessionExpiredException("Sessão sem tokens", null);
            }
            return client;
        } catch (OAuth2AuthorizationException e) {
            log.info(
                    "Renovação de token recusada pelo IdP ({}); sessão encerrada",
                    e.getError().getErrorCode());
            invalidate(request);
            throw new SessionExpiredException("Renovação recusada", e);
        }
    }

    /** A sessão tem {@code wsecurity.admin} (administrador da plataforma, RF-AUT-02). */
    public static boolean isPlatformAdmin(OAuth2AuthorizedClient client) {
        return client.getAccessToken().getScopes().contains(OAuthClientConfiguration.ADMIN_SCOPE);
    }

    /** Access token da sessão atual, renovado se preciso. */
    public String accessToken(HttpServletRequest request, HttpServletResponse response) {
        return authorizedClient(request, response).getAccessToken().getTokenValue();
    }

    private static void invalidate(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }
}
