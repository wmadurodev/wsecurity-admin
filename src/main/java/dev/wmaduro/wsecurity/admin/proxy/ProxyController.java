package dev.wmaduro.wsecurity.admin.proxy;

import dev.wmaduro.wsecurity.admin.proxy.ProxyRoutes.Route;
import dev.wmaduro.wsecurity.admin.proxy.ProxyRoutes.Target;
import dev.wmaduro.wsecurity.admin.session.SessionTokens;
import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import dev.wmaduro.wsecurity.admin.shared.ApiClients;
import dev.wmaduro.wsecurity.admin.shared.Problems;
import dev.wmaduro.wsecurity.admin.shared.UpstreamErrors;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Proxy autenticado da SPA para as APIs (RF-BFF-01..05, DEC-05). Só repassa as rotas de {@link ProxyRoutes}, com o
 * access token da sessão (renovado se preciso) e apenas os cabeçalhos permitidos nos dois sentidos. O BFF não tem
 * regra de negócio (RNF-ARQ-01): a autoridade é sempre a API.
 */
@RestController
class ProxyController {

    /** Limite do corpo das requisições (RNF-SEG-07). */
    static final int MAX_BODY_BYTES = 1024 * 1024;

    static final List<String> REQUEST_HEADERS =
            List.of(HttpHeaders.CONTENT_TYPE, HttpHeaders.ACCEPT, HttpHeaders.IF_MATCH, HttpHeaders.IF_NONE_MATCH);

    /** {@code Location} é tratado à parte (reescrito); paginação só se a API a enviar em cabeçalhos. */
    static final List<String> RESPONSE_HEADERS =
            List.of(HttpHeaders.CONTENT_TYPE, HttpHeaders.ETAG, HttpHeaders.LINK, "X-Total-Count");

    private static final Set<HttpMethod> WRITE_METHODS =
            Set.of(HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE);

    /** Sequências recusadas antes de comparar o caminho com a lista (RNF-SEG-07). */
    private static final Pattern AMBIGUOUS_PATH =
            Pattern.compile("(\\.\\.|//|;|\\\\|%2f|%5c|%2e|%25|%00)", Pattern.CASE_INSENSITIVE);

    private static final Logger accessLog = LoggerFactory.getLogger("dev.wmaduro.wsecurity.admin.proxy.access");

    private final SessionTokens tokens;
    private final ApiClients clients;
    private final AdminProperties properties;

    ProxyController(SessionTokens tokens, ApiClients clients, AdminProperties properties) {
        this.tokens = tokens;
        this.clients = clients;
        this.properties = properties;
    }

    @RequestMapping("/bff/api/idp/**")
    ResponseEntity<?> idp(HttpServletRequest request, HttpServletResponse response) throws IOException {
        return forward(Target.IDP, request, response);
    }

    @RequestMapping("/bff/api/authz/**")
    ResponseEntity<?> authz(HttpServletRequest request, HttpServletResponse response) throws IOException {
        return forward(Target.AUTHZ, request, response);
    }

    private ResponseEntity<?> forward(Target target, HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        long start = System.nanoTime();
        HttpMethod method = HttpMethod.valueOf(request.getMethod());
        String rawPath =
                request.getRequestURI().substring(request.getContextPath().length());
        ResponseEntity<?> result = null;
        try {
            result = route(target, method, rawPath, request, response);
            return result;
        } finally {
            if (WRITE_METHODS.contains(method)) {
                logWrite(request, method, rawPath, result, start);
            }
        }
    }

    private ResponseEntity<?> route(
            Target target, HttpMethod method, String rawPath, HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        if (AMBIGUOUS_PATH.matcher(rawPath).find()) {
            return problem(
                    HttpStatus.BAD_REQUEST,
                    Problems.INVALID_PATH,
                    "Caminho inválido",
                    "O caminho contém sequências que o console não aceita.");
        }
        String path = rawPath.substring(target.bffPrefix.length());
        Optional<Route> route = path.isEmpty() ? Optional.empty() : ProxyRoutes.find(target, method, path);
        if (route.isEmpty()) {
            return problem(
                    HttpStatus.NOT_FOUND,
                    Problems.NOT_FOUND,
                    "Rota não disponível",
                    "Esta operação não está disponível pelo console.");
        }
        Optional<byte[]> body = readBody(request);
        if (body.isEmpty()) {
            return problem(
                    HttpStatus.CONTENT_TOO_LARGE,
                    Problems.PAYLOAD_TOO_LARGE,
                    "Conteúdo grande demais",
                    "O corpo da requisição passa do limite de 1 MiB.");
        }
        OAuth2AuthorizedClient client = tokens.authorizedClient(request, response);
        if (route.get().platform() && !SessionTokens.isPlatformAdmin(client)) {
            return problem(
                    HttpStatus.FORBIDDEN,
                    Problems.FORBIDDEN,
                    "Acesso negado",
                    "Esta operação é exclusiva da administração da plataforma.");
        }
        return call(
                target,
                method,
                path,
                request,
                body.get(),
                client.getAccessToken().getTokenValue());
    }

    private ResponseEntity<?> call(
            Target target, HttpMethod method, String path, HttpServletRequest request, byte[] body, String token) {
        URI apiBase = apiBase(target);
        URI uri = URI.create(apiBase
                + target.apiPrefix
                + path
                + (request.getQueryString() == null ? "" : "?" + request.getQueryString()));
        RestClient restClient = target == Target.IDP ? clients.idp() : clients.authz();
        RestClient.RequestBodySpec spec = restClient.method(method).uri(uri).headers(headers -> {
            for (String name : REQUEST_HEADERS) {
                String value = request.getHeader(name);
                if (value != null) {
                    headers.set(name, value);
                }
            }
            headers.setBearerAuth(token);
        });
        if (body.length > 0) {
            spec.body(body);
        }
        try {
            return spec.exchange((upstreamRequest, upstream) -> {
                HttpHeaders headers = new HttpHeaders();
                for (String name : RESPONSE_HEADERS) {
                    List<String> values = upstream.getHeaders().get(name);
                    if (values != null) {
                        headers.put(name, values);
                    }
                }
                rewriteLocation(upstream.getHeaders().getFirst(HttpHeaders.LOCATION), target, apiBase)
                        .ifPresent(location -> headers.set(HttpHeaders.LOCATION, location));
                byte[] content;
                try (InputStream stream = upstream.getBody()) {
                    content = stream.readAllBytes();
                }
                return ResponseEntity.status(upstream.getStatusCode())
                        .headers(headers)
                        .body(content);
            });
        } catch (ResourceAccessException e) {
            return ResponseEntity.status(UpstreamErrors.problem(e).getStatus()).body(UpstreamErrors.problem(e));
        }
    }

    /**
     * Reescreve o {@code Location} da API para a rota do BFF. Endereços fora do destino não são repassados, para não
     * expor endereços internos.
     */
    static Optional<String> rewriteLocation(String location, Target target, URI apiBase) {
        if (location == null || location.isBlank()) {
            return Optional.empty();
        }
        String path = location;
        String base = apiBase.toString();
        if (path.startsWith(base)) {
            path = path.substring(base.length());
        } else if (URI.create(path).isAbsolute()) {
            return Optional.empty();
        }
        if (path.equals(target.apiPrefix) || path.startsWith(target.apiPrefix + "/")) {
            return Optional.of(target.bffPrefix + path.substring(target.apiPrefix.length()));
        }
        return Optional.empty();
    }

    private URI apiBase(Target target) {
        String base = target == Target.IDP
                ? properties.idp().internalUri().toString()
                : properties.authz().uri().toString();
        return URI.create(base.endsWith("/") ? base.substring(0, base.length() - 1) : base);
    }

    /** O corpo, ou vazio se passar do limite. */
    private static Optional<byte[]> readBody(HttpServletRequest request) throws IOException {
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            return Optional.empty();
        }
        try (InputStream stream = request.getInputStream()) {
            byte[] content = stream.readNBytes(MAX_BODY_BYTES + 1);
            return content.length > MAX_BODY_BYTES ? Optional.empty() : Optional.of(content);
        }
    }

    private static ResponseEntity<?> problem(HttpStatus status, String type, String title, String detail) {
        return ResponseEntity.status(status).body(Problems.of(status, type, title, detail));
    }

    /** RF-BFF-05: quem, o quê, resultado e duração; nunca corpo, token ou cookie. */
    private static void logWrite(
            HttpServletRequest request, HttpMethod method, String path, ResponseEntity<?> result, long start) {
        String subject = request.getUserPrincipal() == null
                ? null
                : request.getUserPrincipal().getName();
        int status = result == null
                ? HttpStatus.INTERNAL_SERVER_ERROR.value()
                : result.getStatusCode().value();
        accessLog
                .atInfo()
                .addKeyValue("sub", subject)
                .addKeyValue("method", method.name())
                .addKeyValue("route", path)
                .addKeyValue("status", status)
                .addKeyValue("durationMs", (System.nanoTime() - start) / 1_000_000)
                .log("Escrita pelo proxy: {} {} → {}", method.name(), path, status);
    }
}
