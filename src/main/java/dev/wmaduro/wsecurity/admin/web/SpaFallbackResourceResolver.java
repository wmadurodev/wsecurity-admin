package dev.wmaduro.wsecurity.admin.web;

import java.io.IOException;
import java.util.Set;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serve os arquivos da SPA e, para rotas de página que não existem como arquivo, devolve o {@code index.html} para que
 * o React Router resolva a rota no navegador. Rotas do BFF ({@code /bff}, {@code /oauth2}, {@code /login},
 * {@code /actuator}) e caminhos com extensão (ex.: um <i>asset</i> inexistente) não caem no {@code index.html}.
 */
class SpaFallbackResourceResolver extends PathResourceResolver {

    static final String INDEX = "index.html";

    private static final Set<String> SERVER_PREFIXES = Set.of("bff", "oauth2", "login", "actuator");

    @Override
    protected Resource getResource(String resourcePath, Resource location) throws IOException {
        Resource resource = super.getResource(resourcePath, location);
        if (resource != null) {
            return resource;
        }
        return isPageRoute(resourcePath) ? super.getResource(INDEX, location) : null;
    }

    static boolean isPageRoute(String resourcePath) {
        String path = resourcePath.startsWith("/") ? resourcePath.substring(1) : resourcePath;
        int slash = path.indexOf('/');
        String firstSegment = slash < 0 ? path : path.substring(0, slash);
        if (SERVER_PREFIXES.contains(firstSegment)) {
            return false;
        }
        String lastSegment = path.substring(path.lastIndexOf('/') + 1);
        return !lastSegment.contains(".");
    }
}
