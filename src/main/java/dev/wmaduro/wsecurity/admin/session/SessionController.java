package dev.wmaduro.wsecurity.admin.session;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Dados da sessão para a SPA (RF-AUT-03). Nunca devolve tokens (RN-01). */
@RestController
class SessionController {

    private final SessionTokens tokens;
    private final TenantAccessClient tenantAccess;
    private final SessionLifetime lifetime;

    SessionController(SessionTokens tokens, TenantAccessClient tenantAccess, SessionLifetime lifetime) {
        this.tokens = tokens;
        this.tenantAccess = tenantAccess;
        this.lifetime = lifetime;
    }

    /**
     * Sessão atual.
     *
     * @param platformAdmin a sessão tem {@code wsecurity.admin}
     * @param mfa o {@code amr} do ID token contém {@code otp}
     * @param expiresAt quando a sessão expira, se não houver uso (inatividade ou idade máxima)
     * @param tenants tenants com alguma permissão {@code core.*}
     * @param tenantsAvailable {@code false} se a API da autorização não respondeu; {@code tenants} vem vazio
     */
    record SessionResponse(
            String sub,
            String name,
            String email,
            boolean platformAdmin,
            boolean mfa,
            Instant expiresAt,
            List<TenantAccessClient.AdministrableTenant> tenants,
            boolean tenantsAvailable) {}

    @GetMapping(BffPaths.SESSION)
    SessionResponse session(
            @AuthenticationPrincipal OidcUser user, HttpServletRequest request, HttpServletResponse response) {
        OAuth2AuthorizedClient client = tokens.authorizedClient(request, response);
        boolean platformAdmin = client.getAccessToken().getScopes().contains(OAuthClientConfiguration.ADMIN_SCOPE);
        List<String> amr = user.getClaimAsStringList("amr");
        Optional<List<TenantAccessClient.AdministrableTenant>> tenants =
                tenantAccess.administrableTenants(client.getAccessToken().getTokenValue());
        return new SessionResponse(
                user.getSubject(),
                user.getFullName(),
                user.getEmail(),
                platformAdmin,
                amr != null && amr.contains("otp"),
                lifetime.expiresAt(request.getSession()),
                tenants.orElse(List.of()),
                tenants.isPresent());
    }
}
