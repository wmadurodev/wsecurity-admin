package dev.wmaduro.wsecurity.admin.proxy;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

/**
 * Rotas permitidas do proxy (RF-BFF-02), exatamente as de 04 §3.2. Cada rota é um método e um padrão de caminho
 * relativo ao destino: {@code /bff/api/idp} → {@code ${IDP}/api/admin/v1} e {@code /bff/api/authz} → {@code ${AZ}/api}.
 * Qualquer outro par método + caminho responde {@code 404} sem chamar a API. {@code ProxyRoutesSpecificationTest}
 * compara esta lista com a tabela da especificação.
 */
final class ProxyRoutes {

    /** Destino de uma rota: prefixo no BFF e prefixo na API. */
    enum Target {
        IDP("/bff/api/idp", "/api/admin/v1"),
        AUTHZ("/bff/api/authz", "/api");

        final String bffPrefix;
        final String apiPrefix;

        Target(String bffPrefix, String apiPrefix) {
            this.bffPrefix = bffPrefix;
            this.apiPrefix = apiPrefix;
        }
    }

    /**
     * Uma rota permitida.
     *
     * @param platform exige {@code wsecurity.admin} na sessão; sem ele, {@code 403} sem chamar a API
     */
    record Route(Target target, Set<HttpMethod> methods, String path, boolean platform, PathPattern pattern) {}

    static final List<Route> ROUTES = build();

    private ProxyRoutes() {}

    /** A rota do destino que aceita o caminho (relativo ao prefixo) e o método. */
    static Optional<Route> find(Target target, HttpMethod method, String path) {
        PathContainer container = PathContainer.parsePath(path);
        return ROUTES.stream()
                .filter(route -> route.target() == target
                        && route.methods().contains(method)
                        && route.pattern().matches(container))
                .findFirst();
    }

    /** Existe alguma rota para o caminho, com qualquer método (para distinguir {@code 404} de {@code 405}). */
    static boolean knownPath(Target target, String path) {
        PathContainer container = PathContainer.parsePath(path);
        return ROUTES.stream()
                .anyMatch(route -> route.target() == target && route.pattern().matches(container));
    }

    private static List<Route> build() {
        Builder routes = new Builder();
        // IdP: todas exigem wsecurity.admin.
        routes.idp("GET, POST", "/users");
        routes.idp("GET, PATCH, DELETE", "/users/{id}");
        routes.idp("POST", "/users/{id}/disable", "/users/{id}/enable", "/users/{id}/unlock");
        routes.idp("POST", "/users/{id}/password-reset", "/users/{id}/mfa/reset");
        routes.idp("GET", "/users/{id}/events");
        routes.idp("GET, POST", "/clients");
        routes.idp("GET, PUT", "/clients/{clientId}");
        routes.idp("POST", "/clients/{clientId}/disable", "/clients/{clientId}/enable");
        routes.idp("GET, POST", "/clients/{clientId}/secrets");
        routes.idp("DELETE", "/clients/{clientId}/secrets/{secretId}");
        routes.idp("GET, POST", "/scopes");
        routes.idp("PATCH", "/scopes/{name}");
        routes.idp("GET", "/keys");
        routes.idp("POST", "/keys/rotate");

        // Autorização, área da plataforma: exigem wsecurity.admin no BFF.
        routes.platform("GET, POST", "/admin/v1/tenants");
        routes.platform("GET, PATCH, DELETE", "/admin/v1/tenants/{t}");
        routes.platform("POST", "/admin/v1/tenants/{t}/suspend", "/admin/v1/tenants/{t}/activate");
        routes.platform("GET", "/admin/v1/tenants/{t}/modules");
        routes.platform("PUT, DELETE", "/admin/v1/tenants/{t}/modules/{m}");
        routes.platform("GET, POST", "/admin/v1/modules");
        routes.platform("GET, PATCH, DELETE", "/admin/v1/modules/{m}");
        routes.platform("GET, POST", "/admin/v1/modules/{m}/features");
        routes.platform("GET, PATCH, DELETE", "/admin/v1/modules/{m}/features/{f}");
        routes.platform("GET, POST", "/admin/v1/roles");
        routes.platform("GET, PUT, DELETE", "/admin/v1/roles/{code}");
        routes.platform("GET", "/admin/v1/keys");
        routes.platform("POST", "/admin/v1/keys/rotate");
        routes.platform("GET", "/admin/v1/audit-events");

        // Autorização, área do tenant: sempre repassadas; quem decide é a API (0002/RN-07, RN-08).
        routes.tenant("GET", "/v1/me/tenants", "/v1/me/tenants/{t}/permissions");
        routes.tenant("GET, PATCH", "/v1/tenants/{t}");
        routes.tenant("GET, POST", "/v1/tenants/{t}/members");
        routes.tenant("GET, PATCH, DELETE", "/v1/tenants/{t}/members/{s}");
        routes.tenant("PUT", "/v1/tenants/{t}/members/{s}/roles");
        routes.tenant("POST", "/v1/tenants/{t}/members/{s}/suspend", "/v1/tenants/{t}/members/{s}/reactivate");
        routes.tenant("GET, POST", "/v1/tenants/{t}/roles");
        routes.tenant("GET, PUT, DELETE", "/v1/tenants/{t}/roles/{code}");
        routes.tenant("GET", "/v1/tenants/{t}/audit-events");
        return List.copyOf(routes.routes);
    }

    private static final class Builder {

        private final PathPatternParser parser = new PathPatternParser();
        private final List<Route> routes = new ArrayList<>();

        void idp(String methods, String... paths) {
            add(Target.IDP, methods, true, paths);
        }

        void platform(String methods, String... paths) {
            add(Target.AUTHZ, methods, true, paths);
        }

        void tenant(String methods, String... paths) {
            add(Target.AUTHZ, methods, false, paths);
        }

        private void add(Target target, String methods, boolean platform, String... paths) {
            Set<HttpMethod> parsed = Set.copyOf(java.util.Arrays.stream(methods.split(",\\s*"))
                    .map(HttpMethod::valueOf)
                    .toList());
            for (String path : paths) {
                routes.add(new Route(target, parsed, path, platform, parser.parse(path)));
            }
        }
    }
}
