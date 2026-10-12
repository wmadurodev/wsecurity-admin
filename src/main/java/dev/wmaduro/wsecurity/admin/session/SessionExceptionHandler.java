package dev.wmaduro.wsecurity.admin.session;

import dev.wmaduro.wsecurity.admin.shared.Problems;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class SessionExceptionHandler {

    @ExceptionHandler(SessionExpiredException.class)
    ProblemDetail sessionExpired() {
        return Problems.of(
                HttpStatus.UNAUTHORIZED,
                Problems.SESSION_EXPIRED,
                "Sessão expirada",
                "A sessão do console terminou. Entre de novo.");
    }
}
