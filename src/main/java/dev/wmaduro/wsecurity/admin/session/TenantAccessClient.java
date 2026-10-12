package dev.wmaduro.wsecurity.admin.session;

import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import dev.wmaduro.wsecurity.admin.shared.ApiClients;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Tenants administráveis do usuário (RF-AUT-03): {@code GET /api/v1/me/tenants} e, em paralelo,
 * {@code GET /api/v1/me/tenants/{t}/permissions}, com o access token da sessão. Ficam só os tenants em que o usuário
 * tem alguma permissão {@code core.*}. A autoridade final continua sendo a API (RN-03).
 */
@Component
class TenantAccessClient {

    static final String CORE_PREFIX = "core.";

    private static final Logger log = LoggerFactory.getLogger(TenantAccessClient.class);

    private final RestClient authz;
    private final Duration timeout;

    TenantAccessClient(ApiClients clients, AdminProperties properties) {
        this.authz = clients.authz();
        this.timeout = properties.proxy().readTimeout();
    }

    record AdministrableTenant(String slug, String name, List<String> roles, List<String> permissions) {}

    record MyTenant(String slug, String name, List<String> roles) {}

    record MyPermissions(List<String> roles, List<String> permissions) {}

    /** Os tenants administráveis, ou vazio se a API da autorização não respondeu a tempo. */
    Optional<List<AdministrableTenant>> administrableTenants(String accessToken) {
        String bearer = "Bearer " + accessToken;
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            long deadline = System.nanoTime() + timeout.toNanos();
            MyTenant[] tenants = executor.submit(() -> authz.get()
                            .uri("/api/v1/me/tenants")
                            .header(HttpHeaders.AUTHORIZATION, bearer)
                            .retrieve()
                            .body(MyTenant[].class))
                    .get(remaining(deadline), TimeUnit.NANOSECONDS);
            List<Future<MyPermissions>> permissions = new ArrayList<>();
            for (MyTenant tenant : tenants == null ? new MyTenant[0] : tenants) {
                permissions.add(executor.submit(() -> authz.get()
                        .uri("/api/v1/me/tenants/{tenant}/permissions", tenant.slug())
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .retrieve()
                        .body(MyPermissions.class)));
            }
            List<AdministrableTenant> result = new ArrayList<>();
            for (int i = 0; i < permissions.size(); i++) {
                MyTenant tenant = tenants[i];
                MyPermissions granted = permissions.get(i).get(remaining(deadline), TimeUnit.NANOSECONDS);
                List<String> grantedPermissions =
                        granted == null || granted.permissions() == null ? List.of() : granted.permissions();
                if (grantedPermissions.stream().anyMatch(permission -> permission.startsWith(CORE_PREFIX))) {
                    result.add(new AdministrableTenant(
                            tenant.slug(),
                            tenant.name(),
                            granted.roles() == null ? List.of() : granted.roles(),
                            grantedPermissions));
                }
            }
            return Optional.of(List.copyOf(result));
        } catch (TimeoutException | ExecutionException | RestClientException e) {
            log.warn("Tenants do usuário indisponíveis na autorização: {}", rootCause(e));
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }

    private static long remaining(long deadline) {
        return Math.max(0, deadline - System.nanoTime());
    }

    private static String rootCause(Throwable error) {
        Throwable cause = error;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause.getClass().getSimpleName();
    }
}
