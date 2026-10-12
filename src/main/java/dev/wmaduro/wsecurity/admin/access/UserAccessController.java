package dev.wmaduro.wsecurity.admin.access;

import dev.wmaduro.wsecurity.admin.session.SessionTokens;
import dev.wmaduro.wsecurity.admin.shared.ApiClients;
import dev.wmaduro.wsecurity.admin.shared.Problems;
import dev.wmaduro.wsecurity.admin.shared.UpstreamErrors;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Acessos de um usuário para a administração da plataforma (RF-BFF-03): tenants, papéis e permissões, consultados em
 * {@code /api/v1/subjects/**} da autorização com o token do cliente de serviço (DEC-07). Só para sessões com
 * {@code wsecurity.admin} (RN-04).
 */
@RestController
class UserAccessController {

    private static final Logger log = LoggerFactory.getLogger(UserAccessController.class);
    private static final Pattern SUBJECT = Pattern.compile("[A-Za-z0-9._-]{1,200}");

    private final SessionTokens sessionTokens;
    private final ServiceTokens serviceTokens;
    private final RestClient authz;

    UserAccessController(SessionTokens sessionTokens, ServiceTokens serviceTokens, ApiClients clients) {
        this.sessionTokens = sessionTokens;
        this.serviceTokens = serviceTokens;
        this.authz = clients.authz();
    }

    record SubjectTenant(String slug, String name, List<String> roles) {}

    record SubjectPermissions(List<String> roles, List<String> permissions) {}

    record TenantAccess(String slug, String name, List<String> roles, List<String> permissions) {}

    record UserAccess(String sub, List<TenantAccess> tenants) {}

    @GetMapping("/bff/users/{sub}/access")
    ResponseEntity<?> access(@PathVariable String sub, HttpServletRequest request, HttpServletResponse response) {
        if (!SessionTokens.isPlatformAdmin(sessionTokens.authorizedClient(request, response))) {
            return problem(
                    HttpStatus.FORBIDDEN,
                    Problems.FORBIDDEN,
                    "Acesso negado",
                    "Os acessos de um usuário são exclusivos da administração da plataforma.");
        }
        if (!SUBJECT.matcher(sub).matches()) {
            return problem(
                    HttpStatus.BAD_REQUEST, Problems.INVALID_PATH, "Usuário inválido", "O identificador é inválido.");
        }
        if (!serviceTokens.configured()) {
            return serviceUnavailable("O cliente de serviço do console não está configurado "
                    + "(WSECURITY_ADMIN_SERVICE_CLIENT_ID e _SECRET).");
        }
        try {
            Optional<String> token = serviceTokens.accessToken();
            if (token.isEmpty()) {
                return serviceUnavailable("O IdP não emitiu o token do cliente de serviço.");
            }
            return ResponseEntity.ok(new UserAccess(sub, tenants(sub, "Bearer " + token.get())));
        } catch (OAuth2AuthorizationException e) {
            log.warn(
                    "Token do cliente de serviço recusado pelo IdP: {}",
                    e.getError().getErrorCode());
            return serviceUnavailable("O IdP recusou as credenciais do cliente de serviço do console.");
        } catch (RestClientResponseException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .contentType(Optional.ofNullable(e.getResponseHeaders())
                            .map(HttpHeaders::getContentType)
                            .orElse(MediaType.APPLICATION_PROBLEM_JSON))
                    .body(e.getResponseBodyAsByteArray());
        } catch (ResourceAccessException e) {
            return ResponseEntity.status(UpstreamErrors.problem(e).getStatus()).body(UpstreamErrors.problem(e));
        }
    }

    private List<TenantAccess> tenants(String sub, String bearer) {
        SubjectTenant[] tenants = authz.get()
                .uri("/api/v1/subjects/{sub}/tenants", sub)
                .header(HttpHeaders.AUTHORIZATION, bearer)
                .retrieve()
                .body(SubjectTenant[].class);
        List<TenantAccess> result = new ArrayList<>();
        for (SubjectTenant tenant : tenants == null ? new SubjectTenant[0] : tenants) {
            SubjectPermissions permissions = authz.get()
                    .uri("/api/v1/subjects/{sub}/tenants/{tenant}/permissions", sub, tenant.slug())
                    .header(HttpHeaders.AUTHORIZATION, bearer)
                    .retrieve()
                    .body(SubjectPermissions.class);
            result.add(new TenantAccess(
                    tenant.slug(),
                    tenant.name(),
                    permissions == null || permissions.roles() == null ? tenant.roles() : permissions.roles(),
                    permissions == null || permissions.permissions() == null ? List.of() : permissions.permissions()));
        }
        return List.copyOf(result);
    }

    private static ResponseEntity<?> serviceUnavailable(String detail) {
        return problem(
                HttpStatus.SERVICE_UNAVAILABLE,
                Problems.SERVICE_UNAVAILABLE,
                "Consulta de acessos indisponível",
                detail);
    }

    private static ResponseEntity<?> problem(HttpStatus status, String type, String title, String detail) {
        return ResponseEntity.status(status).body(Problems.of(status, type, title, detail));
    }
}
