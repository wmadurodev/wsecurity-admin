package dev.wmaduro.wsecurity.admin.shared;

import org.springframework.web.client.RestClient;

/**
 * Clientes HTTP do BFF para as APIs, pelos endereços internos (DEC-08): {@code idp} aponta para
 * {@code idp.internal-uri} e {@code authz} para {@code authz.uri}. Não seguem redirecionamentos (RNF-SEG-07) e têm os
 * tempos limite de {@code proxy.*} (RNF-DES-03). Os pedidos levam o {@code traceparent} da requisição (RNF-SEG-10).
 */
public record ApiClients(RestClient idp, RestClient authz) {}
