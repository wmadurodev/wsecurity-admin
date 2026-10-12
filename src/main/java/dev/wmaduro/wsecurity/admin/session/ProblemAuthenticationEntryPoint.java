package dev.wmaduro.wsecurity.admin.session;

import dev.wmaduro.wsecurity.admin.shared.Problems;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

/** {@code /bff/**} sem sessão responde {@code 401} em Problem Details, nunca {@code 302} (04 §3.1). */
class ProblemAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException {
        Problems.write(
                response,
                HttpStatus.UNAUTHORIZED,
                Problems.UNAUTHENTICATED,
                "Sessão ausente",
                "Entre no console para continuar.");
    }
}
