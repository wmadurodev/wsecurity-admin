package dev.wmaduro.wsecurity.admin.shared;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;

/**
 * Respostas de erro do BFF em Problem Details (RFC 9457), com {@code type} sob {@link #BASE_URI}, como nas APIs das
 * fases 0001/0002. Nunca incluem detalhes internos.
 */
public final class Problems {

    public static final String BASE_URI = "https://wsecurity.dev/problems/";

    /** Requisição a {@code /bff/**} sem sessão. */
    public static final String UNAUTHENTICATED = "unauthenticated";

    /** A sessão terminou (idade máxima, renovação recusada pelo IdP). */
    public static final String SESSION_EXPIRED = "session-expired";

    private Problems() {}

    public static URI type(String slug) {
        return URI.create(BASE_URI + slug);
    }

    public static ProblemDetail of(HttpStatus status, String slug, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(type(slug));
        problem.setTitle(title);
        return problem;
    }

    /** Escreve o problema direto na resposta (filtros e pontos de entrada da segurança, fora do Spring MVC). */
    public static void write(HttpServletResponse response, HttpStatus status, String slug, String title, String detail)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter()
                .write("{\"type\":\"" + BASE_URI + slug + "\",\"title\":\"" + escape(title) + "\",\"status\":"
                        + status.value() + ",\"detail\":\"" + escape(detail) + "\"}");
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
