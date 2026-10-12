package dev.wmaduro.wsecurity.admin.shared;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * No perfil {@code prod}, a subida falha se faltar alguma configuração obrigatória (RNF-OPE-01, 04 §5). A mensagem
 * cita só os nomes das variáveis, nunca os valores (RNF-SEG-06).
 */
@Component
@Profile("prod")
class ProductionConfigurationCheck implements InitializingBean {

    private final AdminProperties properties;

    ProductionConfigurationCheck(AdminProperties properties) {
        this.properties = properties;
    }

    @Override
    public void afterPropertiesSet() {
        List<String> missing = missingVariables(properties);
        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Configuração obrigatória ausente no perfil prod: " + String.join(", ", missing));
        }
    }

    static List<String> missingVariables(AdminProperties properties) {
        List<String> missing = new ArrayList<>();
        if (isBlank(properties.idp().issuer())) {
            missing.add("WSECURITY_ADMIN_IDP_ISSUER");
        }
        if (isBlank(properties.publicUri())) {
            missing.add("WSECURITY_ADMIN_PUBLIC_URI");
        }
        if (isBlank(properties.client().id())) {
            missing.add("WSECURITY_ADMIN_CLIENT_ID");
        }
        if (isBlank(properties.client().secret())) {
            missing.add("WSECURITY_ADMIN_CLIENT_SECRET");
        }
        return missing;
    }

    private static boolean isBlank(URI uri) {
        return uri == null || isBlank(uri.toString());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
