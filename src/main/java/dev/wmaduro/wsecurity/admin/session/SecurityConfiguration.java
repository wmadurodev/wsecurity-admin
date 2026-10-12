package dev.wmaduro.wsecurity.admin.session;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Cadeia de segurança <b>provisória</b> do prompt 01: libera tudo para que a SPA vazia seja servida. O prompt 03
 * substitui esta configuração pelo login OIDC, sessão, CSRF e cabeçalhos de segurança.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) {
        return http.authorizeHttpRequests(requests -> requests.anyRequest().permitAll())
                .build();
    }
}
