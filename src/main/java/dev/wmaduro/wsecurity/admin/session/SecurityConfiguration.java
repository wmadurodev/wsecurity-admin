package dev.wmaduro.wsecurity.admin.session;

import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import dev.wmaduro.wsecurity.admin.shared.ApiClients;
import java.time.Clock;
import java.util.LinkedHashMap;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.DelegatingAuthenticationEntryPoint;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.header.writers.CrossOriginOpenerPolicyHeaderWriter.CrossOriginOpenerPolicy;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.savedrequest.HttpSessionRequestCache;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.AndRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * Segurança do BFF (RF-AUT, RNF-SEG-01..05): login OIDC com recuo de escopo, sessão no servidor, CSRF no modo SPA,
 * logout no IdP e cabeçalhos de segurança. Páginas sem sessão vão para o login; {@code /bff/**} sem sessão responde
 * {@code 401}.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {

    static final String PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), "
            + "magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()";

    private static final PathPatternRequestMatcher.Builder PATHS = PathPatternRequestMatcher.withDefaults();

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    SessionLifetime sessionLifetime(AdminProperties properties, Clock clock) {
        return new SessionLifetime(properties, clock);
    }

    /** O filtro roda dentro da cadeia de segurança, não como filtro do contêiner. */
    @Bean
    FilterRegistrationBean<SessionLifetime> sessionLifetimeRegistration(SessionLifetime filter) {
        FilterRegistrationBean<SessionLifetime> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ClientRegistrationRepository registrations,
            OAuth2AuthorizedClientRepository authorizedClients,
            ApiClients clients,
            AdminProperties properties,
            SessionLifetime sessionLifetime,
            Environment environment) {
        boolean dev = environment.acceptsProfiles(Profiles.of("dev"));
        RequestMatcher bff = PATHS.matcher(BffPaths.PREFIX + "/**");

        HttpSessionRequestCache requestCache = new HttpSessionRequestCache();
        requestCache.setRequestMatcher(
                new AndRequestMatcher(PATHS.matcher(HttpMethod.GET, "/**"), new NegatedRequestMatcher(bff)));

        return http.authorizeHttpRequests(requests -> requests.requestMatchers(
                                "/assets/**",
                                "/favicon.svg",
                                "/pages/**",
                                ScopeFallback.LOGIN_ERROR,
                                "/error",
                                // Porta de gerenciamento (9201): só health e info são expostos (RNF-SEG-06).
                                "/actuator/**")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .oauth2Login(login -> login.loginPage(ScopeFallback.LOGIN_PAGE)
                        .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(
                                ScopeFallback.authorizationRequestResolver(registrations)))
                        .authorizedClientRepository(authorizedClients)
                        .successHandler(ScopeFallback.successHandler())
                        .failureHandler(ScopeFallback.failureHandler()))
                .requestCache(cache -> cache.requestCache(requestCache))
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(entryPoint(bff)))
                .logout(logout -> logout.logoutRequestMatcher(PATHS.matcher(HttpMethod.POST, BffPaths.LOGOUT))
                        .addLogoutHandler(LogoutHandlers.revocation(authorizedClients, clients, properties))
                        .logoutSuccessHandler(
                                LogoutHandlers.success(registrations, postLogoutRedirectUri(properties, dev))))
                .csrf(csrf -> csrf.spa())
                .sessionManagement(sessions -> sessions.sessionFixation(fixation -> fixation.changeSessionId()))
                .addFilterBefore(sessionLifetime, SecurityContextHolderFilter.class)
                .headers(headers -> {
                    headers.contentSecurityPolicy(csp -> csp.policyDirectives(contentSecurityPolicy(properties)))
                            .referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.NO_REFERRER))
                            .crossOriginOpenerPolicy(coop -> coop.policy(CrossOriginOpenerPolicy.SAME_ORIGIN))
                            .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy", PERMISSIONS_POLICY));
                    if (dev) {
                        headers.httpStrictTransportSecurity(hsts -> hsts.disable());
                    } else {
                        headers.httpStrictTransportSecurity(
                                hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000));
                    }
                })
                .build();
    }

    /** {@code /bff/**} responde {@code 401}; as páginas vão para o login (registro {@code wsecurity}). */
    static AuthenticationEntryPoint entryPoint(RequestMatcher bff) {
        LinkedHashMap<RequestMatcher, AuthenticationEntryPoint> entryPoints = new LinkedHashMap<>();
        entryPoints.put(bff, new ProblemAuthenticationEntryPoint());
        DelegatingAuthenticationEntryPoint delegating = new DelegatingAuthenticationEntryPoint(entryPoints);
        delegating.setDefaultEntryPoint(new LoginUrlAuthenticationEntryPoint(ScopeFallback.LOGIN_PAGE));
        return delegating;
    }

    /** RNF-SEG-04: sem {@code unsafe-inline}/{@code unsafe-eval}; formulários só para o próprio console e o IdP. */
    static String contentSecurityPolicy(AdminProperties properties) {
        String idp = OAuthClientConfiguration.withoutTrailingSlash(
                properties.idp().issuer().toString());
        return "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
                + "frame-ancestors 'none'; base-uri 'self'; form-action 'self' " + idp;
    }

    /**
     * Página inicial do console depois do logout. Em {@code dev}, a origem da requisição ({@code {baseUrl}}, que
     * respeita {@code X-Forwarded-*}), para o modo Vite (5174) voltar ao Vite; fora de {@code dev}, {@code public-uri}.
     */
    static String postLogoutRedirectUri(AdminProperties properties, boolean dev) {
        return dev
                ? "{baseUrl}/"
                : OAuthClientConfiguration.withoutTrailingSlash(
                                properties.publicUri().toString()) + "/";
    }
}
