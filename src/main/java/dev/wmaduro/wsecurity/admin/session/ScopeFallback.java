package dev.wmaduro.wsecurity.admin.session;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;

/**
 * Recuo de escopo (RF-AUT-02, DEC-03). O IdP recusa {@code wsecurity.admin} a quem não é administrador com
 * {@code error=invalid_scope}, e só depois do login. Nesse caso o login é refeito pelo registro {@code wsecurity-basic};
 * a sessão do IdP já existe, então não há nova senha. A URL de retorno (requisição salva) é preservada. Um contador na
 * sessão limita o recuo a uma vez por tentativa: ele zera ao iniciar um login pelo registro {@code wsecurity} e quando
 * o login termina com sucesso. Qualquer outro erro leva a {@code /login-error} (RF-AUT-07).
 */
final class ScopeFallback {

    static final String LOGIN_PAGE = OAuth2AuthorizationRequestRedirectFilter.DEFAULT_AUTHORIZATION_REQUEST_BASE_URI
            + "/" + OAuthClientConfiguration.ADMIN_REGISTRATION;
    static final String BASIC_LOGIN = OAuth2AuthorizationRequestRedirectFilter.DEFAULT_AUTHORIZATION_REQUEST_BASE_URI
            + "/" + OAuthClientConfiguration.BASIC_REGISTRATION;
    static final String LOGIN_ERROR = "/login-error";
    static final String ATTEMPTS = ScopeFallback.class.getName() + ".ATTEMPTS";
    static final int MAX_ATTEMPTS = 1;

    private static final Logger log = LoggerFactory.getLogger(ScopeFallback.class);
    private static final String ADMIN_CALLBACK = "/login/oauth2/code/" + OAuthClientConfiguration.ADMIN_REGISTRATION;

    private ScopeFallback() {}

    /** Resolve os pedidos de autorização com PKCE (também para o cliente confidencial) e zera o contador. */
    static OAuth2AuthorizationRequestResolver authorizationRequestResolver(ClientRegistrationRepository registrations) {
        DefaultOAuth2AuthorizationRequestResolver delegate = new DefaultOAuth2AuthorizationRequestResolver(
                registrations, OAuth2AuthorizationRequestRedirectFilter.DEFAULT_AUTHORIZATION_REQUEST_BASE_URI);
        delegate.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
        return new OAuth2AuthorizationRequestResolver() {
            @Override
            public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
                return resetOnAdminLogin(request, delegate.resolve(request));
            }

            @Override
            public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
                return resetOnAdminLogin(request, delegate.resolve(request, registrationId));
            }
        };
    }

    private static OAuth2AuthorizationRequest resetOnAdminLogin(
            HttpServletRequest request, OAuth2AuthorizationRequest authorizationRequest) {
        if (authorizationRequest != null
                && OAuthClientConfiguration.ADMIN_REGISTRATION.equals(
                        authorizationRequest.getAttribute(OAuth2ParameterNames.REGISTRATION_ID))) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.removeAttribute(ATTEMPTS);
            }
        }
        return authorizationRequest;
    }

    static AuthenticationFailureHandler failureHandler() {
        return ScopeFallback::onFailure;
    }

    static AuthenticationSuccessHandler successHandler() {
        SavedRequestAwareAuthenticationSuccessHandler delegate = new SavedRequestAwareAuthenticationSuccessHandler();
        return (request, response, authentication) -> {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.removeAttribute(ATTEMPTS);
            }
            delegate.onAuthenticationSuccess(request, response, authentication);
        };
    }

    private static void onFailure(
            HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException {
        if (isAdminScopeRefused(request, exception)) {
            HttpSession session = request.getSession();
            int attempts = session.getAttribute(ATTEMPTS) instanceof Integer count ? count : 0;
            if (attempts < MAX_ATTEMPTS) {
                session.setAttribute(ATTEMPTS, attempts + 1);
                response.sendRedirect(request.getContextPath() + BASIC_LOGIN);
                return;
            }
        }
        log.info("Login recusado: {}", errorCode(exception));
        response.sendRedirect(request.getContextPath() + LOGIN_ERROR);
    }

    private static boolean isAdminScopeRefused(HttpServletRequest request, AuthenticationException exception) {
        return OAuth2ErrorCodes.INVALID_SCOPE.equals(errorCode(exception))
                && request.getRequestURI().endsWith(ADMIN_CALLBACK);
    }

    private static String errorCode(AuthenticationException exception) {
        return exception instanceof OAuth2AuthenticationException oauth
                ? oauth.getError().getErrorCode()
                : exception.getClass().getSimpleName();
    }
}
