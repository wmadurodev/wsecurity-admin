package dev.wmaduro.wsecurity.admin.session;

import jakarta.servlet.http.HttpServletRequest;

/** Caminhos das rotas próprias do BFF (04 §3.1). */
final class BffPaths {

    static final String PREFIX = "/bff";
    static final String SESSION = PREFIX + "/session";
    static final String LOGOUT = PREFIX + "/logout";

    private BffPaths() {}

    static boolean isBff(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return path.equals(PREFIX) || path.startsWith(PREFIX + "/");
    }
}
