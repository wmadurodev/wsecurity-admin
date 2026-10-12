package dev.wmaduro.wsecurity.admin.session;

/** A sessão não pode mais obter tokens (renovação recusada pelo IdP, RF-AUT-04); ela já foi invalidada. */
class SessionExpiredException extends RuntimeException {

    SessionExpiredException(String message, Throwable cause) {
        super(message, cause);
    }
}
