package dev.wmaduro.wsecurity.admin.proxy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

/**
 * A lista de rotas do proxy é exatamente a tabela 04 §3.2 da especificação (RF-BFF-02). Lê o Markdown do
 * {@code wsecurity-docs} no workspace; fora do workspace (clone isolado do módulo), o teste é ignorado.
 */
class ProxyRoutesSpecificationTest {

    private static final Path SPEC =
            Path.of("../../wsecurity-docs/specification/0004-admin-console/04-arquitetura-e-telas.md");
    private static final Pattern CODE = Pattern.compile("`([^`]+)`");
    private static final Pattern ALTERNATIVES = Pattern.compile("\\{([^{}]*,[^{}]*)}");

    @Test
    void routesMatchTheSpecificationTable() throws IOException {
        assumeTrue(Files.exists(SPEC), "especificação fora do workspace");

        assertThat(fromCode()).containsExactlyElementsOf(fromSpecification(Files.readAllLines(SPEC)));
    }

    @Test
    void everyRouteHasAtLeastOneMethodAndAPathUnderItsTarget() {
        assertThat(ProxyRoutes.ROUTES).allSatisfy(route -> {
            assertThat(route.methods()).isNotEmpty();
            assertThat(route.path()).startsWith("/");
        });
        assertThat(ProxyRoutes.ROUTES)
                .filteredOn(route -> route.target() == ProxyRoutes.Target.IDP)
                .allMatch(ProxyRoutes.Route::platform);
    }

    private static Set<String> fromCode() {
        Set<String> routes = new TreeSet<>();
        for (ProxyRoutes.Route route : ProxyRoutes.ROUTES) {
            for (HttpMethod method : route.methods()) {
                routes.add(key(route.target().name(), method.name(), route.path(), route.platform()));
            }
        }
        return routes;
    }

    static Set<String> fromSpecification(List<String> lines) {
        Set<String> routes = new TreeSet<>();
        String target = null;
        boolean inSection = false;
        for (String line : lines) {
            if (line.startsWith("### 3.2")) {
                inSection = true;
                continue;
            }
            if (inSection && (line.startsWith("## ") || line.startsWith("Ficam **fora**"))) {
                break;
            }
            if (!inSection) {
                continue;
            }
            if (line.startsWith("Prefixo `/bff/api/idp`")) {
                target = "IDP";
            } else if (line.startsWith("Prefixo `/bff/api/authz`")) {
                target = "AUTHZ";
            }
            if (target == null || !line.startsWith("| ") || line.startsWith("| Métodos") || line.startsWith("|--")) {
                continue;
            }
            String[] cells = line.split("\\|");
            String methods = cells[1].trim();
            boolean platform = target.equals("IDP") || cells[3].trim().startsWith("sim");
            Matcher paths = CODE.matcher(cells[2]);
            while (paths.find()) {
                for (String path : expand(paths.group(1))) {
                    for (String method : methods.split(",\\s*")) {
                        routes.add(key(target, method.trim(), path, platform));
                    }
                }
            }
        }
        return routes;
    }

    /** {@code /users/{id}/{disable,enable}} → {@code /users/{id}/disable} e {@code /users/{id}/enable}. */
    static List<String> expand(String path) {
        Matcher matcher = ALTERNATIVES.matcher(path);
        if (!matcher.find()) {
            return List.of(path);
        }
        List<String> expanded = new ArrayList<>();
        for (String alternative : matcher.group(1).split(",")) {
            expanded.addAll(expand(path.substring(0, matcher.start()) + alternative + path.substring(matcher.end())));
        }
        return expanded;
    }

    /** As variáveis do caminho só importam pela posição: {@code {id}} e {@code {sub}} são equivalentes. */
    private static String key(String target, String method, String path, boolean platform) {
        return target + " " + method + " " + path.replaceAll("\\{[^}]+}", "{}") + (platform ? " plataforma" : "");
    }
}
