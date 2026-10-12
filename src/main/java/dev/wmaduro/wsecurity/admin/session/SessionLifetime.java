package dev.wmaduro.wsecurity.admin.session;

import dev.wmaduro.wsecurity.admin.shared.AdminProperties;
import dev.wmaduro.wsecurity.admin.shared.Problems;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Expiração da sessão do console (RF-AUT-05): por inatividade ({@code session.idle-timeout}, aplicada pelo contêiner
 * a cada sessão criada) e por idade máxima desde a criação ({@code session.max-age}, verificada por este filtro antes
 * da segurança). Uma sessão vencida é invalidada; em {@code /bff/**} a resposta é {@code 401} {@code session-expired},
 * e nas páginas a navegação segue para o login.
 */
class SessionLifetime extends OncePerRequestFilter implements HttpSessionListener {

    private final AdminProperties.Session settings;
    private final Clock clock;

    SessionLifetime(AdminProperties properties, Clock clock) {
        this.settings = properties.session();
        this.clock = clock;
    }

    @Override
    public void sessionCreated(HttpSessionEvent event) {
        event.getSession()
                .setMaxInactiveInterval(Math.toIntExact(settings.idleTimeout().toSeconds()));
    }

    /** Momento em que a sessão expira: o que vier primeiro entre inatividade e idade máxima. */
    Instant expiresAt(HttpSession session) {
        Instant byIdle = Instant.ofEpochMilli(session.getLastAccessedTime()).plus(settings.idleTimeout());
        Instant byAge = createdAt(session).plus(settings.maxAge());
        return byIdle.isBefore(byAge) ? byIdle : byAge;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session != null && isTooOld(session)) {
            session.invalidate();
            if (BffPaths.isBff(request)) {
                Problems.write(
                        response,
                        HttpStatus.UNAUTHORIZED,
                        Problems.SESSION_EXPIRED,
                        "Sessão expirada",
                        "A sessão do console atingiu a duração máxima. Entre de novo.");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private boolean isTooOld(HttpSession session) {
        try {
            return !clock.instant().isBefore(createdAt(session).plus(settings.maxAge()));
        } catch (IllegalStateException alreadyInvalidated) {
            return false;
        }
    }

    private static Instant createdAt(HttpSession session) {
        return Instant.ofEpochMilli(session.getCreationTime());
    }
}
