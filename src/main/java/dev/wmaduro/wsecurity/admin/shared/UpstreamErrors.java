package dev.wmaduro.wsecurity.admin.shared;

import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.client.ResourceAccessException;

/**
 * Falhas de comunicação com as APIs (RF-BFF-04): falha de conexão → {@code 502} {@code upstream-unavailable}; tempo
 * esgotado na resposta → {@code 504} {@code upstream-timeout}. Sem detalhes internos (endereços, exceções).
 */
public final class UpstreamErrors {

    private UpstreamErrors() {}

    public static ProblemDetail problem(ResourceAccessException failure) {
        if (isResponseTimeout(failure)) {
            return Problems.of(
                    HttpStatus.GATEWAY_TIMEOUT,
                    Problems.UPSTREAM_TIMEOUT,
                    "A API demorou demais para responder",
                    "O serviço não respondeu a tempo. Tente de novo em instantes.");
        }
        return Problems.of(
                HttpStatus.BAD_GATEWAY,
                Problems.UPSTREAM_UNAVAILABLE,
                "API indisponível",
                "Não foi possível falar com o serviço. Tente de novo em instantes.");
    }

    /** Tempo esgotado esperando a resposta; o tempo esgotado na conexão conta como indisponibilidade. */
    static boolean isResponseTimeout(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof HttpConnectTimeoutException) {
                return false;
            }
            if (cause instanceof HttpTimeoutException) {
                return true;
            }
        }
        return false;
    }
}
